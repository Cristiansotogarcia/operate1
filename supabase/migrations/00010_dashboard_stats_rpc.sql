-- ============================================================
-- 00010 — Dashboard Stats RPC
-- Returns all dashboard counters in a single query to avoid
-- exhausting the PostgREST connection pool on the free tier.
-- ============================================================

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
      'monitors_total',     (select count(*) from monitors where tenant_id = p_tenant_id)
    )
  );
end;
$$;

grant execute on function get_dashboard_stats(uuid) to anon, authenticated;
