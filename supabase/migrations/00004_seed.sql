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
