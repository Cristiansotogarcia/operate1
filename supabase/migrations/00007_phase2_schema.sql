-- ============================================================
-- 00007 — Phase 2 Schema
-- Operate1 — Audit log, SLA, Time tracking, Attachments,
--             API keys, Email routing, Webhooks
-- ============================================================

-- ─── AUDIT LOGS ──────────────────────────────────────────────
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,           -- e.g. 'ticket.created', 'ticket.status_changed'
  entity_type text not null,      -- e.g. 'ticket', 'device', 'monitor'
  entity_id uuid,
  entity_label text,              -- human-readable identifier (ticket number, device name)
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  created_at timestamptz default now()
);

create index if not exists audit_logs_tenant_id_idx on audit_logs(tenant_id);
create index if not exists audit_logs_actor_id_idx on audit_logs(actor_id);
create index if not exists audit_logs_entity_idx on audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on audit_logs(created_at desc);

-- ─── SLA POLICIES ────────────────────────────────────────────
create table if not exists sla_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  ticket_type_id uuid references ticket_types(id) on delete set null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  response_minutes integer not null default 480,   -- first response target
  resolve_minutes integer not null default 2880,   -- resolution target
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sla_policies_tenant_id_idx on sla_policies(tenant_id);

-- Add priority + sla tracking columns to tickets
alter table tickets
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'critical')),
  add column if not exists sla_policy_id uuid references sla_policies(id) on delete set null,
  add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists sla_breached boolean not null default false;

-- ─── TIME ENTRIES ────────────────────────────────────────────
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id) on delete cascade,
  technician_id uuid references profiles(id) on delete set null,
  description text,
  minutes integer not null check (minutes > 0),
  billable boolean not null default true,
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists time_entries_tenant_id_idx on time_entries(tenant_id);
create index if not exists time_entries_ticket_id_idx on time_entries(ticket_id);
create index if not exists time_entries_technician_id_idx on time_entries(technician_id);

-- ─── TICKET ATTACHMENTS ──────────────────────────────────────
-- Files stored in Supabase Storage bucket: ticket-attachments
create table if not exists ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null references tickets(id) on delete cascade,
  comment_id uuid references ticket_comments(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_size integer,              -- bytes
  mime_type text,
  storage_path text not null,     -- path within bucket
  created_at timestamptz default now()
);

create index if not exists ticket_attachments_ticket_id_idx on ticket_attachments(ticket_id);

-- ─── KB ATTACHMENTS ──────────────────────────────────────────
-- Files stored in Supabase Storage bucket: kb-attachments
create table if not exists kb_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  article_id uuid not null references kb_articles(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  file_name text not null,
  file_size integer,
  mime_type text,
  storage_path text not null,
  created_at timestamptz default now()
);

create index if not exists kb_attachments_article_id_idx on kb_attachments(article_id);

-- ─── API KEYS ────────────────────────────────────────────────
-- Worker registration API keys (replaces per-device registration_key approach
-- for multi-device onboarding flows)
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  key_hash text not null unique,   -- bcrypt or sha256 hash of the actual key
  key_prefix text not null,        -- first 8 chars for display (e.g. "op1_abc1")
  scopes text[] not null default array['worker:register'],
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create index if not exists api_keys_tenant_id_idx on api_keys(tenant_id);
create index if not exists api_keys_key_hash_idx on api_keys(key_hash);

-- ─── EMAIL ROUTES ────────────────────────────────────────────
-- Inbound email-to-ticket routing rules (structure ready; needs Resend inbound)
create table if not exists email_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  inbound_address text not null,   -- e.g. support@tickets.yourdomain.com
  company_id uuid references companies(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  ticket_type_id uuid references ticket_types(id) on delete set null,
  default_status text not null default 'pending'
    check (default_status in ('pending', 'open', 'in_progress')),
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, inbound_address)
);

create index if not exists email_routes_tenant_id_idx on email_routes(tenant_id);

-- ─── WEBHOOK CONFIGS ─────────────────────────────────────────
-- Slack / Teams / generic outbound webhooks
create table if not exists webhook_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  url text not null,
  provider text not null default 'generic'
    check (provider in ('slack', 'teams', 'generic')),
  events text[] not null default array['ticket.created'],
  is_active boolean not null default true,
  secret text,                     -- HMAC signing secret (optional)
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists webhook_configs_tenant_id_idx on webhook_configs(tenant_id);
