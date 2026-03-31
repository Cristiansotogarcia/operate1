-- ============================================================
-- 00001 — Initial Schema
-- Operate1 / Xatech Helpdesk MVP
-- ============================================================

-- TENANTS
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- PROFILES (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  full_name text,
  username text,
  role text not null default 'user'
    check (role in ('admin', 'user')),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists profiles_tenant_id_idx on profiles(tenant_id);
create index if not exists profiles_role_idx on profiles(role);

-- COMPANIES
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  notes text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists companies_tenant_id_idx on companies(tenant_id);

-- COST CENTERS
create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  description text,
  created_at timestamptz default now(),
  unique(tenant_id, code)
);

create index if not exists cost_centers_tenant_id_idx on cost_centers(tenant_id);

-- SITES
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid not null references companies(id) on delete cascade,
  cost_center_id uuid references cost_centers(id) on delete set null,
  name text not null,
  address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sites_tenant_id_idx on sites(tenant_id);
create index if not exists sites_company_id_idx on sites(company_id);

-- CONTRACTS
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid references companies(id) on delete set null,
  contract_number text not null,
  name text not null,
  type text not null default 'custom'
    check (type in ('custom', 'standard', 'hourly')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'expired', 'cancelled')),
  starts_at date,
  ends_at date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, contract_number)
);

create index if not exists contracts_tenant_id_idx on contracts(tenant_id);
create index if not exists contracts_company_id_idx on contracts(company_id);

-- TICKET TYPES
create table if not exists ticket_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  created_at timestamptz default now(),
  unique(tenant_id, name)
);

create index if not exists ticket_types_tenant_id_idx on ticket_types(tenant_id);

-- TICKETS
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_number text not null,
  company_id uuid references companies(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  ticket_type_id uuid references ticket_types(id) on delete set null,
  contact_email text not null,
  contact_name text,
  subject text not null,
  description text,
  status text not null default 'pending'
    check (status in ('pending', 'open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, ticket_number)
);

create index if not exists tickets_tenant_id_idx on tickets(tenant_id);
create index if not exists tickets_company_id_idx on tickets(company_id);
create index if not exists tickets_status_idx on tickets(status);
create index if not exists tickets_created_at_idx on tickets(created_at desc);

-- TICKET COMMENTS
create table if not exists ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists ticket_comments_ticket_id_idx on ticket_comments(ticket_id);

-- KB CATEGORIES
create table if not exists kb_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  created_at timestamptz default now(),
  unique(tenant_id, name)
);

-- KB ARTICLES
create table if not exists kb_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  title text not null,
  body text,
  type text not null default 'internal'
    check (type in ('internal', 'public')),
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  category_id uuid references kb_categories(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  author_id uuid references profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists kb_articles_tenant_id_idx on kb_articles(tenant_id);

-- DEVICES
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  company_id uuid references companies(id) on delete set null,
  registration_key text unique not null default gen_random_uuid()::text,
  api_secret text not null default 'pending',
  name text not null,
  computer_name text,
  os text,
  status text not null default 'offline'
    check (status in ('online', 'offline')),
  last_seen_at timestamptz,
  last_ip text,
  cpu_percent numeric(5,2),
  ram_percent numeric(5,2),
  disk_percent numeric(5,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists devices_tenant_id_idx on devices(tenant_id);
create index if not exists devices_registration_key_idx on devices(registration_key);

-- DEVICE HEARTBEATS
create table if not exists device_heartbeats (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references devices(id) on delete cascade,
  cpu_percent numeric(5,2),
  ram_percent numeric(5,2),
  disk_percent numeric(5,2),
  ip_address text,
  recorded_at timestamptz default now()
);

create index if not exists device_heartbeats_device_id_idx on device_heartbeats(device_id);
create index if not exists device_heartbeats_recorded_at_idx on device_heartbeats(recorded_at desc);

-- MONITORS
create table if not exists monitors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  device_id uuid references devices(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  name text not null,
  type text not null
    check (type in ('http', 'icmp', 'tcp')),
  target text not null,
  port integer,
  interval_seconds integer not null default 60,
  status text not null default 'active'
    check (status in ('active', 'paused')),
  last_status text not null default 'unknown'
    check (last_status in ('up', 'down', 'unknown')),
  last_checked_at timestamptz,
  uptime_percent numeric(5,2) default 0,
  avg_response_ms integer default 0,
  failure_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists monitors_tenant_id_idx on monitors(tenant_id);
create index if not exists monitors_device_id_idx on monitors(device_id);

-- MONITOR RESULTS
create table if not exists monitor_results (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references monitors(id) on delete cascade,
  status text not null check (status in ('up', 'down')),
  response_ms integer,
  error_message text,
  checked_at timestamptz default now()
);

create index if not exists monitor_results_monitor_id_idx on monitor_results(monitor_id);
create index if not exists monitor_results_checked_at_idx on monitor_results(checked_at desc);

-- USER COMPANY ACCESS
create table if not exists user_company_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  created_at timestamptz default now(),
  unique(profile_id, company_id)
);

create index if not exists user_company_access_profile_id_idx on user_company_access(profile_id);

-- USER SITE ACCESS
create table if not exists user_site_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  created_at timestamptz default now(),
  unique(profile_id, site_id)
);

create index if not exists user_site_access_profile_id_idx on user_site_access(profile_id);
