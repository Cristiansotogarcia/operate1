-- ============================================================
-- 00013 — Pairing codes for device onboarding
-- Short-lived codes admins generate from the dashboard.
-- The agent enters the code to pair and start reporting.
-- ============================================================

-- Pairing codes table
create table if not exists pairing_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null unique,
  device_id uuid not null references devices(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  site_id uuid references sites(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists pairing_codes_code_idx on pairing_codes(code);
create index if not exists pairing_codes_device_id_idx on pairing_codes(device_id);

-- Add site_id to devices (maps device to a site)
alter table devices
  add column if not exists site_id uuid references sites(id) on delete set null;

create index if not exists devices_site_id_idx on devices(site_id);

-- RLS
alter table pairing_codes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'pairing_codes_admin_all' and tablename = 'pairing_codes') then
    create policy "pairing_codes_admin_all" on pairing_codes
      for all using (
        tenant_id = auth_tenant_id()
        and auth_role() = 'admin'
      );
  end if;
end $$;

notify pgrst, 'reload schema';
