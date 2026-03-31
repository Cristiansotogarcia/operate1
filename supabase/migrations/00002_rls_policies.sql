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
