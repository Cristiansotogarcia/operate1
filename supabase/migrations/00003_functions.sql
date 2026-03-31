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
