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
-- ============================================================
-- 00003 — Functions and Triggers
-- ============================================================

-- Helper: get calling user's role (security definer avoids RLS recursion)
create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper: get calling user's tenant_id
create or replace function get_my_tenant_id()
returns uuid
language sql
security definer
stable
as $$
  select tenant_id from profiles where id = auth.uid();
$$;

-- Trigger: auto-create profile when auth.users row is inserted
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_tenant_id uuid;
begin
  select id into default_tenant_id from tenants limit 1;

  insert into profiles (id, tenant_id, full_name, username, role)
  values (
    new.id,
    default_tenant_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Trigger: update updated_at timestamp
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at trigger to all relevant tables
create or replace function create_updated_at_trigger(tbl text)
returns void
language plpgsql
as $$
begin
  execute format(
    'drop trigger if exists set_updated_at on %I;
     create trigger set_updated_at
       before update on %I
       for each row execute function update_updated_at();',
    tbl, tbl
  );
end;
$$;

select create_updated_at_trigger('profiles');
select create_updated_at_trigger('companies');
select create_updated_at_trigger('sites');
select create_updated_at_trigger('contracts');
select create_updated_at_trigger('tickets');
select create_updated_at_trigger('kb_articles');
select create_updated_at_trigger('devices');
select create_updated_at_trigger('monitors');

-- Ticket number sequence (per tenant via function)
create sequence if not exists ticket_number_seq start with 1 increment by 1;

create or replace function generate_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'TK-' || lpad(nextval('ticket_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists set_ticket_number on tickets;
create trigger set_ticket_number
  before insert on tickets
  for each row execute function generate_ticket_number();

-- Function: mark devices offline if last_seen_at is stale (called by pg_cron or on-read)
create or replace function mark_stale_devices_offline(threshold_minutes int default 2)
returns void
language plpgsql
security definer
as $$
begin
  update devices
  set status = 'offline'
  where status = 'online'
    and last_seen_at < now() - (threshold_minutes || ' minutes')::interval;
end;
$$;

-- Function: recalculate monitor stats after new result
create or replace function recalculate_monitor_stats(p_monitor_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_total int;
  v_up int;
  v_avg_ms int;
  v_failures int;
begin
  select
    count(*),
    count(*) filter (where status = 'up'),
    coalesce(avg(response_ms) filter (where status = 'up'), 0)::int,
    count(*) filter (where status = 'down')
  into v_total, v_up, v_avg_ms, v_failures
  from monitor_results
  where monitor_id = p_monitor_id
    and checked_at > now() - interval '24 hours';

  update monitors set
    uptime_percent = case when v_total > 0 then round((v_up::numeric / v_total) * 100, 2) else 0 end,
    avg_response_ms = v_avg_ms,
    failure_count = v_failures,
    updated_at = now()
  where id = p_monitor_id;
end;
$$;
-- ============================================================
-- 00002 — Row Level Security Policies
-- ============================================================
-- All policies use get_my_role() and get_my_tenant_id() helpers
-- (defined in 00003_functions.sql which runs after this via alphabetical order)
-- We inline the subqueries here to avoid dependency ordering issues.

-- TENANTS — everyone authenticated can read their own tenant
alter table tenants enable row level security;

create policy "tenants_select" on tenants
  for select using (
    id = (select tenant_id from profiles where id = auth.uid())
  );

-- PROFILES
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_select_admin" on profiles
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

create policy "profiles_update_admin" on profiles
  for update using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "profiles_insert_trigger" on profiles
  for insert with check (true); -- trigger is security definer, service role bypasses

-- COMPANIES
alter table companies enable row level security;

create policy "companies_admin_all" on companies
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "companies_user_select" on companies
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );

-- COST CENTERS
alter table cost_centers enable row level security;

create policy "cost_centers_admin_all" on cost_centers
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "cost_centers_user_select" on cost_centers
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

-- SITES
alter table sites enable row level security;

create policy "sites_admin_all" on sites
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "sites_user_select" on sites
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and id in (
      select site_id from user_site_access where profile_id = auth.uid()
    )
  );

-- CONTRACTS
alter table contracts enable row level security;

create policy "contracts_admin_all" on contracts
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "contracts_user_select" on contracts
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and company_id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );

-- TICKET TYPES
alter table ticket_types enable row level security;

create policy "ticket_types_admin_all" on ticket_types
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "ticket_types_user_select" on ticket_types
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

-- TICKETS
alter table tickets enable row level security;

create policy "tickets_admin_all" on tickets
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "tickets_user_select" on tickets
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and company_id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );

create policy "tickets_user_insert" on tickets
  for insert with check (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and company_id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );

create policy "tickets_user_update_own" on tickets
  for update using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and created_by = auth.uid()
  );

-- TICKET COMMENTS
alter table ticket_comments enable row level security;

create policy "ticket_comments_admin_all" on ticket_comments
  for all using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "ticket_comments_user_select" on ticket_comments
  for select using (
    ticket_id in (
      select id from tickets where company_id in (
        select company_id from user_company_access where profile_id = auth.uid()
      )
    )
  );

create policy "ticket_comments_user_insert" on ticket_comments
  for insert with check (author_id = auth.uid());

-- KB CATEGORIES
alter table kb_categories enable row level security;

create policy "kb_categories_admin_all" on kb_categories
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "kb_categories_user_select" on kb_categories
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

-- KB ARTICLES
alter table kb_articles enable row level security;

create policy "kb_articles_admin_all" on kb_articles
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "kb_articles_user_select" on kb_articles
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and status = 'published'
    and (
      company_id is null
      or company_id in (
        select company_id from user_company_access where profile_id = auth.uid()
      )
    )
  );

-- DEVICES
alter table devices enable row level security;

create policy "devices_admin_all" on devices
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "devices_user_select" on devices
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and company_id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );

-- DEVICE HEARTBEATS — admin read, service role write (via edge functions)
alter table device_heartbeats enable row level security;

create policy "device_heartbeats_admin_select" on device_heartbeats
  for select using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "device_heartbeats_service_insert" on device_heartbeats
  for insert with check (true); -- edge function uses service role

-- MONITORS
alter table monitors enable row level security;

create policy "monitors_admin_all" on monitors
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "monitors_user_select" on monitors
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and company_id in (
      select company_id from user_company_access where profile_id = auth.uid()
    )
  );

-- MONITOR RESULTS
alter table monitor_results enable row level security;

create policy "monitor_results_admin_select" on monitor_results
  for select using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "monitor_results_user_select" on monitor_results
  for select using (
    monitor_id in (
      select id from monitors where company_id in (
        select company_id from user_company_access where profile_id = auth.uid()
      )
    )
  );

create policy "monitor_results_service_insert" on monitor_results
  for insert with check (true); -- edge function uses service role

-- USER COMPANY ACCESS
alter table user_company_access enable row level security;

create policy "user_company_access_admin_all" on user_company_access
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "user_company_access_user_select_own" on user_company_access
  for select using (profile_id = auth.uid());

-- USER SITE ACCESS
alter table user_site_access enable row level security;

create policy "user_site_access_admin_all" on user_site_access
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "user_site_access_user_select_own" on user_site_access
  for select using (profile_id = auth.uid());
-- ============================================================
-- 00004 — Seed Data
-- ============================================================

-- Default tenant (MVP: single tenant deployment)
insert into tenants (id, name, slug)
values ('00000000-0000-0000-0000-000000000001', 'Default MSP', 'default')
on conflict (slug) do nothing;

-- Default ticket types
insert into ticket_types (tenant_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Network Support'),
  ('00000000-0000-0000-0000-000000000001', 'Hardware Support'),
  ('00000000-0000-0000-0000-000000000001', 'Software Support'),
  ('00000000-0000-0000-0000-000000000001', 'Application Support'),
  ('00000000-0000-0000-0000-000000000001', 'General Request')
on conflict (tenant_id, name) do nothing;

-- Default KB category
insert into kb_categories (tenant_id, name) values
  ('00000000-0000-0000-0000-000000000001', 'General'),
  ('00000000-0000-0000-0000-000000000001', 'Network'),
  ('00000000-0000-0000-0000-000000000001', 'Hardware'),
  ('00000000-0000-0000-0000-000000000001', 'Software')
on conflict (tenant_id, name) do nothing;

-- Default cost center
insert into cost_centers (tenant_id, code, description) values
  ('00000000-0000-0000-0000-000000000001', 'CC01', 'Default Cost Center')
on conflict (tenant_id, code) do nothing;

-- NOTE: Admin user must be created via Supabase Auth (Dashboard or CLI).
-- After creating via Auth, the handle_new_user trigger will auto-create the profile.
-- To promote to admin, run:
--   update profiles set role = 'admin' where id = '<user-uuid>';
