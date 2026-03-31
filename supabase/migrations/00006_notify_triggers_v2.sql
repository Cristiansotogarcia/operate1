-- Migration 00006: Notification trigger functions with hardcoded Supabase URL
-- Replaces 00005 approach (alter database not permitted on Supabase hosted)

create extension if not exists pg_net schema extensions;

-- ─── Ticket notification trigger ──────────────────────────────────────────────
create or replace function notify_ticket_event()
returns trigger as $$
declare
  event_type text;
  payload    jsonb;
begin
  if TG_OP = 'INSERT' then
    event_type := 'created';
  else
    if OLD.status = NEW.status then return NEW; end if;
    event_type := 'updated';
  end if;

  payload := jsonb_build_object(
    'ticket_id', NEW.id,
    'event',     event_type,
    'status',    NEW.status
  );

  perform extensions.http_post(
    'https://yhdyuzdfocvtgyatnrqz.supabase.co/functions/v1/notify-ticket',
    payload::text,
    'application/json'
  );

  return NEW;
exception when others then
  -- Never fail a ticket write due to notification error
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_ticket_notify on tickets;
create trigger on_ticket_notify
  after insert or update on tickets
  for each row execute function notify_ticket_event();

-- ─── Monitor down alert trigger ───────────────────────────────────────────────
create or replace function notify_monitor_down_event()
returns trigger as $$
declare
  payload jsonb;
begin
  if NEW.last_status = 'down' and (OLD.last_status is distinct from 'down') then
    payload := jsonb_build_object(
      'monitor_id',   NEW.id,
      'monitor_name', NEW.name,
      'target',       NEW.target,
      'checked_at',   NEW.last_checked_at
    );

    perform extensions.http_post(
      'https://yhdyuzdfocvtgyatnrqz.supabase.co/functions/v1/notify-monitor-down',
      payload::text,
      'application/json'
    );
  end if;

  return NEW;
exception when others then
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_monitor_down_notify on monitors;
create trigger on_monitor_down_notify
  after update on monitors
  for each row execute function notify_monitor_down_event();
