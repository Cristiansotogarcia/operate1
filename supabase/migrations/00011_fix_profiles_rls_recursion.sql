-- ============================================================
-- 00011 — Fix infinite recursion in profiles RLS policies
--
-- Problem: profiles_select_admin and profiles_update_admin
-- query the profiles table in their USING clause, which
-- triggers their own policy evaluation → infinite recursion.
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS.
-- ============================================================

-- Helper: get current user's tenant_id (bypasses RLS)
create or replace function auth_tenant_id()
returns uuid
language sql
security definer
stable
as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- Helper: get current user's role (bypasses RLS)
create or replace function auth_role()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid()
$$;

-- Drop the recursive profiles policies
drop policy if exists "profiles_select_admin" on profiles;
drop policy if exists "profiles_update_own" on profiles;
drop policy if exists "profiles_update_admin" on profiles;

-- Recreate without self-referencing subqueries
create policy "profiles_select_admin" on profiles
  for select using (
    tenant_id = auth_tenant_id()
    and auth_role() = 'admin'
  );

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin" on profiles
  for update using (
    tenant_id = auth_tenant_id()
    and auth_role() = 'admin'
  );

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
