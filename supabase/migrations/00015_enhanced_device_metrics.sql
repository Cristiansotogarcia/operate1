-- ============================================================
-- 00015 — Enhanced Device Metrics: Battery, Power State,
--         Disk Health, Agent Updates, Shutdown Tracking
-- ============================================================

-- ── Extended device columns ─────────────────────────────────

alter table devices add column if not exists battery_percent    smallint;
alter table devices add column if not exists battery_charging   boolean;
alter table devices add column if not exists ac_connected       boolean;
alter table devices add column if not exists power_source       text;         -- 'ac', 'battery', 'ups'
alter table devices add column if not exists disk_type          text;         -- 'SSD', 'HDD', 'NVMe'
alter table devices add column if not exists disk_io_read_mb    real;
alter table devices add column if not exists disk_io_write_mb   real;
alter table devices add column if not exists smart_status       text;         -- 'ok', 'caution', 'failing'
alter table devices add column if not exists disk_temp_c        smallint;
alter table devices add column if not exists agent_version      text;
alter table devices add column if not exists last_shutdown      text;         -- 'graceful', 'restart', 'unexpected', 'update'
alter table devices add column if not exists last_boot_at       timestamptz;

-- ── Extended heartbeat columns ──────────────────────────────

alter table device_heartbeats add column if not exists battery_percent    smallint;
alter table device_heartbeats add column if not exists battery_charging   boolean;
alter table device_heartbeats add column if not exists ac_connected       boolean;
alter table device_heartbeats add column if not exists power_source       text;
alter table device_heartbeats add column if not exists disk_io_read_mb    real;
alter table device_heartbeats add column if not exists disk_io_write_mb   real;

-- ── Agent Updates table ─────────────────────────────────────

create table if not exists agent_updates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id),
  version      text not null,
  download_url text not null,
  release_notes text,
  is_mandatory boolean default false,
  platform     text default 'win32',
  published_at timestamptz default now(),
  created_at   timestamptz default now()
);

alter table agent_updates enable row level security;

create policy "agent_updates_select" on agent_updates
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

create policy "agent_updates_admin" on agent_updates
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Allow anon/service read for the agent itself (no auth)
create policy "agent_updates_public_read" on agent_updates
  for select using (true);

notify pgrst, 'reload schema';
