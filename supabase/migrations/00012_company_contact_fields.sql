-- ============================================================
-- 00012 — Company contact fields
-- Adds phone, email, website, address, contact_person
-- ============================================================

alter table companies
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists website text,
  add column if not exists address text,
  add column if not exists contact_person text;

notify pgrst, 'reload schema';
