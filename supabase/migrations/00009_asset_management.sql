-- ============================================================
-- 00009 — Asset Management
-- Adds serial number, warranty, asset tag, assigned user,
-- device type, and notes to the devices table
-- ============================================================

alter table devices
  add column if not exists asset_tag text,
  add column if not exists serial_number text,
  add column if not exists model text,
  add column if not exists manufacturer text,
  add column if not exists device_type text not null default 'workstation'
    check (device_type in ('workstation', 'laptop', 'server', 'network', 'printer', 'mobile', 'other')),
  add column if not exists assigned_user_id uuid references profiles(id) on delete set null,
  add column if not exists warranty_expires_at date,
  add column if not exists purchased_at date,
  add column if not exists notes text;

create index if not exists devices_assigned_user_idx on devices(assigned_user_id);
create index if not exists devices_serial_idx on devices(serial_number);
