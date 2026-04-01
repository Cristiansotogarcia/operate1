-- ============================================================
-- 00014 — Competitive Feature Gap: Templates, Views, RBAC,
--         SLA Escalation, Email Templates, Custom Fields
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TICKET TEMPLATES / MACROS
-- ────────────────────────────────────────────────────────────

create table ticket_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  name         text not null,
  subject      text,
  description  text,
  priority     text default 'normal',
  ticket_type_id uuid references ticket_types(id) on delete set null,
  company_id   uuid references companies(id) on delete set null,
  tags         text[] default '{}',
  is_active    boolean default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table ticket_templates enable row level security;

create policy "ticket_templates_select" on ticket_templates
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "ticket_templates_admin" on ticket_templates
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- ────────────────────────────────────────────────────────────
-- 2. CUSTOM TICKET VIEWS / SAVED FILTERS
-- ────────────────────────────────────────────────────────────

create table ticket_views (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  filters      jsonb not null default '{}',
  sort_by      text default 'created_at',
  sort_dir     text default 'desc',
  is_default   boolean default false,
  is_shared    boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table ticket_views enable row level security;

-- Users can see own views + shared views from same tenant
create policy "ticket_views_select" on ticket_views
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (user_id = auth.uid() or is_shared = true)
  );

-- Users can manage their own views
create policy "ticket_views_manage_own" on ticket_views
  for all using (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 3. GRANULAR RBAC — Custom Roles & Permissions
-- ────────────────────────────────────────────────────────────

create table custom_roles (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  name         text not null,
  description  text,
  is_system    boolean default false,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(tenant_id, name)
);

create table role_permissions (
  id           uuid primary key default gen_random_uuid(),
  role_id      uuid not null references custom_roles(id) on delete cascade,
  module       text not null,
  can_view     boolean default false,
  can_create   boolean default false,
  can_edit     boolean default false,
  can_delete   boolean default false,
  unique(role_id, module)
);

-- Link profiles to custom roles (nullable, backwards-compatible)
alter table profiles add column if not exists custom_role_id uuid references custom_roles(id) on delete set null;

alter table custom_roles enable row level security;
alter table role_permissions enable row level security;

create policy "custom_roles_select" on custom_roles
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "custom_roles_admin" on custom_roles
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "role_permissions_select" on role_permissions
  for select using (
    role_id in (select id from custom_roles where tenant_id = (select tenant_id from profiles where id = auth.uid()))
  );

create policy "role_permissions_admin" on role_permissions
  for all using (
    role_id in (select id from custom_roles where tenant_id = (select tenant_id from profiles where id = auth.uid()))
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Seed default roles for the default tenant
insert into custom_roles (tenant_id, name, description, is_system) values
  ('00000000-0000-0000-0000-000000000001', 'Administrator', 'Full access to all modules', true),
  ('00000000-0000-0000-0000-000000000001', 'Technician', 'Can manage tickets, devices, and monitoring', true),
  ('00000000-0000-0000-0000-000000000001', 'Viewer', 'Read-only access to assigned resources', true);

-- Seed permissions for default roles
do $$
declare
  v_admin_id uuid;
  v_tech_id uuid;
  v_viewer_id uuid;
  v_modules text[] := array['tickets','companies','contracts','sites','devices','monitoring','knowledge','reporting','audit','api_keys','integrations','users','sla'];
  v_mod text;
begin
  select id into v_admin_id from custom_roles where name = 'Administrator' and tenant_id = '00000000-0000-0000-0000-000000000001';
  select id into v_tech_id from custom_roles where name = 'Technician' and tenant_id = '00000000-0000-0000-0000-000000000001';
  select id into v_viewer_id from custom_roles where name = 'Viewer' and tenant_id = '00000000-0000-0000-0000-000000000001';

  foreach v_mod in array v_modules loop
    insert into role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
    values (v_admin_id, v_mod, true, true, true, true);
  end loop;

  foreach v_mod in array array['tickets','devices','monitoring','knowledge'] loop
    insert into role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
    values (v_tech_id, v_mod, true, true, true, false);
  end loop;

  foreach v_mod in array array['companies','contracts','sites','reporting'] loop
    insert into role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
    values (v_tech_id, v_mod, true, false, false, false);
  end loop;

  foreach v_mod in array v_modules loop
    insert into role_permissions (role_id, module, can_view, can_create, can_edit, can_delete)
    values (v_viewer_id, v_mod, true, false, false, false);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────
-- 4. SLA ESCALATION RULES
-- ────────────────────────────────────────────────────────────

create table sla_escalation_rules (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id),
  sla_policy_id     uuid not null references sla_policies(id) on delete cascade,
  name              text not null,
  trigger_type      text not null check (trigger_type in ('response_warning','response_breach','resolve_warning','resolve_breach')),
  trigger_percent   int not null default 80,
  action_type       text not null check (action_type in ('notify','reassign','change_priority','add_comment')),
  action_config     jsonb not null default '{}',
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table sla_escalation_rules enable row level security;

create policy "sla_escalation_select" on sla_escalation_rules
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "sla_escalation_admin" on sla_escalation_rules
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- ────────────────────────────────────────────────────────────
-- 5. EMAIL TEMPLATES (Rich HTML notifications)
-- ────────────────────────────────────────────────────────────

create table email_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  name         text not null,
  event        text not null,
  subject_template text not null,
  body_html    text not null,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(tenant_id, event)
);

alter table email_templates enable row level security;

create policy "email_templates_select" on email_templates
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "email_templates_admin" on email_templates
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Seed default templates
insert into email_templates (tenant_id, name, event, subject_template, body_html) values
  ('00000000-0000-0000-0000-000000000001', 'Ticket Created', 'ticket.created',
   'Ticket {{ticket_number}} — {{subject}}',
   '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px"><div style="background:#0891b2;padding:16px 24px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:18px">Operate1</h1></div><div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px"><h2 style="margin:0 0 16px;color:#111827">New Ticket: {{ticket_number}}</h2><p style="color:#6b7280;margin:0 0 8px"><strong>Subject:</strong> {{subject}}</p><p style="color:#6b7280;margin:0 0 8px"><strong>Status:</strong> {{status}}</p><p style="color:#6b7280;margin:0 0 8px"><strong>Priority:</strong> {{priority}}</p><p style="color:#6b7280;margin:0 0 16px"><strong>Contact:</strong> {{contact_email}}</p><div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px"><p style="color:#374151;margin:0;white-space:pre-wrap">{{description}}</p></div><p style="color:#9ca3af;font-size:12px;margin:0">This is an automated notification from Operate1.</p></div></div>'),

  ('00000000-0000-0000-0000-000000000001', 'Ticket Updated', 'ticket.updated',
   'Ticket {{ticket_number}} updated — {{subject}}',
   '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px"><div style="background:#0891b2;padding:16px 24px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:18px">Operate1</h1></div><div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px"><h2 style="margin:0 0 16px;color:#111827">Ticket Updated: {{ticket_number}}</h2><p style="color:#6b7280;margin:0 0 8px"><strong>Subject:</strong> {{subject}}</p><p style="color:#6b7280;margin:0 0 8px"><strong>New Status:</strong> {{status}}</p><p style="color:#6b7280;margin:0 0 16px"><strong>Priority:</strong> {{priority}}</p><p style="color:#9ca3af;font-size:12px;margin:0">This is an automated notification from Operate1.</p></div></div>'),

  ('00000000-0000-0000-0000-000000000001', 'SLA Breach Warning', 'sla.warning',
   '[URGENT] SLA at risk — Ticket {{ticket_number}}',
   '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:24px"><div style="background:#dc2626;padding:16px 24px;border-radius:12px 12px 0 0"><h1 style="color:#fff;margin:0;font-size:18px">⚠ SLA Warning — Operate1</h1></div><div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px"><h2 style="margin:0 0 16px;color:#111827">SLA At Risk: {{ticket_number}}</h2><p style="color:#6b7280;margin:0 0 8px"><strong>Subject:</strong> {{subject}}</p><p style="color:#6b7280;margin:0 0 8px"><strong>Policy:</strong> {{sla_name}}</p><p style="color:#dc2626;margin:0 0 16px;font-weight:600">{{trigger_type}} deadline approaching — {{trigger_percent}}% elapsed</p><p style="color:#9ca3af;font-size:12px;margin:0">Please take action to prevent an SLA breach.</p></div></div>');

-- ────────────────────────────────────────────────────────────
-- 6. CUSTOM FIELDS ON TICKETS
-- ────────────────────────────────────────────────────────────

create table custom_field_definitions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  entity_type  text not null default 'ticket',
  name         text not null,
  label        text not null,
  field_type   text not null check (field_type in ('text','number','select','checkbox','date','textarea')),
  options      jsonb default '[]',
  is_required  boolean default false,
  sort_order   int default 0,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(tenant_id, entity_type, name)
);

create table custom_field_values (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  field_id     uuid not null references custom_field_definitions(id) on delete cascade,
  entity_id    uuid not null,
  value        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(field_id, entity_id)
);

alter table custom_field_definitions enable row level security;
alter table custom_field_values enable row level security;

create policy "custom_fields_def_select" on custom_field_definitions
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "custom_fields_def_admin" on custom_field_definitions
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "custom_fields_val_select" on custom_field_values
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "custom_fields_val_manage" on custom_field_values
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────
-- Update dashboard RPC to include new counts
-- ────────────────────────────────────────────────────────────
create or replace function get_dashboard_stats(p_tenant_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return (
    select json_build_object(
      'tickets_total',      (select count(*) from tickets  where tenant_id = p_tenant_id),
      'tickets_open',       (select count(*) from tickets  where tenant_id = p_tenant_id and status = 'open'),
      'tickets_pending',    (select count(*) from tickets  where tenant_id = p_tenant_id and status = 'pending'),
      'tickets_in_progress',(select count(*) from tickets  where tenant_id = p_tenant_id and status = 'in_progress'),
      'companies_total',    (select count(*) from companies where tenant_id = p_tenant_id),
      'contracts_active',   (select count(*) from contracts where tenant_id = p_tenant_id and status = 'active'),
      'devices_online',     (select count(*) from devices  where tenant_id = p_tenant_id and status = 'online'),
      'devices_offline',    (select count(*) from devices  where tenant_id = p_tenant_id and status = 'offline'),
      'devices_total',      (select count(*) from devices  where tenant_id = p_tenant_id),
      'monitors_up',        (select count(*) from monitors where tenant_id = p_tenant_id and last_status = 'up'),
      'monitors_down',      (select count(*) from monitors where tenant_id = p_tenant_id and last_status = 'down'),
      'monitors_total',     (select count(*) from monitors where tenant_id = p_tenant_id),
      'templates_total',    (select count(*) from ticket_templates where tenant_id = p_tenant_id and is_active = true),
      'sla_breached_count', (select count(*) from tickets where tenant_id = p_tenant_id and sla_breached = true and status not in ('resolved','closed'))
    )
  );
end;
$$;

grant execute on function get_dashboard_stats(uuid) to anon, authenticated;
