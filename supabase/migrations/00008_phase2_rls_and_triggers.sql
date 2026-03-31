-- ============================================================
-- 00008 — Phase 2 RLS Policies + Audit Log Triggers
-- ============================================================

-- ─── AUDIT LOGS ──────────────────────────────────────────────
alter table audit_logs enable row level security;

create policy "audit_logs_admin_select" on audit_logs
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "audit_logs_service_insert" on audit_logs
  for insert with check (true); -- written by triggers (security definer) and edge functions

-- ─── SLA POLICIES ────────────────────────────────────────────
alter table sla_policies enable row level security;

create policy "sla_policies_admin_all" on sla_policies
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "sla_policies_user_select" on sla_policies
  for select using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
  );

-- ─── TIME ENTRIES ────────────────────────────────────────────
alter table time_entries enable row level security;

create policy "time_entries_admin_all" on time_entries
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "time_entries_user_own" on time_entries
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and technician_id = auth.uid()
  );

-- ─── TICKET ATTACHMENTS ──────────────────────────────────────
alter table ticket_attachments enable row level security;

create policy "ticket_attachments_admin_all" on ticket_attachments
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "ticket_attachments_user_select" on ticket_attachments
  for select using (
    ticket_id in (
      select id from tickets where company_id in (
        select company_id from user_company_access where profile_id = auth.uid()
      )
    )
  );

create policy "ticket_attachments_user_insert" on ticket_attachments
  for insert with check (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and uploaded_by = auth.uid()
  );

-- ─── KB ATTACHMENTS ──────────────────────────────────────────
alter table kb_attachments enable row level security;

create policy "kb_attachments_admin_all" on kb_attachments
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "kb_attachments_user_select" on kb_attachments
  for select using (
    article_id in (
      select id from kb_articles
      where status = 'published'
      and tenant_id = (select tenant_id from profiles where id = auth.uid())
    )
  );

-- ─── API KEYS ────────────────────────────────────────────────
alter table api_keys enable row level security;

create policy "api_keys_admin_all" on api_keys
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- ─── EMAIL ROUTES ────────────────────────────────────────────
alter table email_routes enable row level security;

create policy "email_routes_admin_all" on email_routes
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- ─── WEBHOOK CONFIGS ─────────────────────────────────────────
alter table webhook_configs enable row level security;

create policy "webhook_configs_admin_all" on webhook_configs
  for all using (
    tenant_id = (select tenant_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'admin'
  );

-- ─── AUDIT LOG TRIGGER FUNCTION ──────────────────────────────
-- Generic helper: call log_audit(actor_id, action, entity_type, entity_id, label, old, new)
create or replace function log_audit_event(
  p_tenant_id uuid,
  p_actor_id  uuid,
  p_action    text,
  p_entity_type text,
  p_entity_id   uuid,
  p_entity_label text,
  p_old_values  jsonb default null,
  p_new_values  jsonb default null
) returns void as $$
begin
  insert into audit_logs (
    tenant_id, actor_id, action, entity_type, entity_id,
    entity_label, old_values, new_values
  ) values (
    p_tenant_id, p_actor_id, p_action, p_entity_type, p_entity_id,
    p_entity_label, p_old_values, p_new_values
  );
exception when others then
  -- Never fail the original operation due to audit logging
  null;
end;
$$ language plpgsql security definer;

-- ─── TICKET AUDIT TRIGGER ────────────────────────────────────
create or replace function audit_ticket_changes()
returns trigger as $$
declare
  v_action text;
  v_old    jsonb := null;
  v_new    jsonb;
begin
  if TG_OP = 'INSERT' then
    v_action := 'ticket.created';
    v_new    := jsonb_build_object(
      'status', NEW.status, 'subject', NEW.subject, 'priority', NEW.priority
    );
  elsif TG_OP = 'UPDATE' then
    if OLD.status <> NEW.status then
      v_action := 'ticket.status_changed';
    elsif OLD.assigned_to is distinct from NEW.assigned_to then
      v_action := 'ticket.assigned';
    else
      v_action := 'ticket.updated';
    end if;
    v_old := jsonb_build_object('status', OLD.status, 'assigned_to', OLD.assigned_to);
    v_new := jsonb_build_object('status', NEW.status, 'assigned_to', NEW.assigned_to);
  elsif TG_OP = 'DELETE' then
    v_action := 'ticket.deleted';
    v_old    := jsonb_build_object('subject', OLD.subject, 'status', OLD.status);
    perform log_audit_event(OLD.tenant_id, null, v_action, 'ticket', OLD.id, OLD.ticket_number, v_old, null);
    return OLD;
  end if;

  perform log_audit_event(NEW.tenant_id, NEW.created_by, v_action, 'ticket', NEW.id, NEW.ticket_number, v_old, v_new);
  return NEW;
exception when others then
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_ticket_audit on tickets;
create trigger on_ticket_audit
  after insert or update or delete on tickets
  for each row execute function audit_ticket_changes();

-- ─── DEVICE AUDIT TRIGGER ────────────────────────────────────
create or replace function audit_device_changes()
returns trigger as $$
declare
  v_action text;
begin
  if TG_OP = 'INSERT' then
    v_action := 'device.registered';
  elsif TG_OP = 'UPDATE' then
    if OLD.status <> NEW.status then
      v_action := case when NEW.status = 'online' then 'device.came_online' else 'device.went_offline' end;
    else
      v_action := 'device.updated';
    end if;
  else
    return OLD;
  end if;

  perform log_audit_event(
    NEW.tenant_id, null, v_action, 'device', NEW.id, NEW.name,
    case when TG_OP = 'UPDATE' then jsonb_build_object('status', OLD.status) else null end,
    jsonb_build_object('status', NEW.status, 'last_ip', NEW.last_ip)
  );
  return NEW;
exception when others then
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_device_audit on devices;
create trigger on_device_audit
  after insert or update on devices
  for each row execute function audit_device_changes();

-- ─── MONITOR AUDIT TRIGGER ───────────────────────────────────
create or replace function audit_monitor_changes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    perform log_audit_event(
      NEW.tenant_id, null, 'monitor.created', 'monitor', NEW.id, NEW.name,
      null, jsonb_build_object('type', NEW.type, 'target', NEW.target)
    );
  elsif TG_OP = 'UPDATE' and OLD.last_status is distinct from NEW.last_status then
    perform log_audit_event(
      NEW.tenant_id, null, 'monitor.status_changed', 'monitor', NEW.id, NEW.name,
      jsonb_build_object('last_status', OLD.last_status),
      jsonb_build_object('last_status', NEW.last_status)
    );
  end if;
  return NEW;
exception when others then
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_monitor_audit on monitors;
create trigger on_monitor_audit
  after insert or update on monitors
  for each row execute function audit_monitor_changes();

-- ─── SLA BREACH CHECK FUNCTION ───────────────────────────────
-- Called periodically or on ticket update to mark SLA breaches
create or replace function check_sla_breach(p_ticket_id uuid)
returns void as $$
declare
  v_ticket  tickets%rowtype;
  v_policy  sla_policies%rowtype;
  v_breached boolean := false;
begin
  select * into v_ticket from tickets where id = p_ticket_id;
  if not found then return; end if;
  if v_ticket.sla_policy_id is null then return; end if;

  select * into v_policy from sla_policies where id = v_ticket.sla_policy_id;
  if not found then return; end if;

  -- Check resolve SLA
  if v_ticket.status not in ('resolved', 'closed') then
    if now() > v_ticket.created_at + (v_policy.resolve_minutes * interval '1 minute') then
      v_breached := true;
    end if;
  end if;

  if v_breached and not v_ticket.sla_breached then
    update tickets set sla_breached = true where id = p_ticket_id;
  end if;
end;
$$ language plpgsql security definer;
