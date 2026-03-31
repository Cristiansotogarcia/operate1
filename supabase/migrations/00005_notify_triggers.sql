-- Migration 00005: Notification triggers via pg_net → Edge Functions
-- NOTE: Requires pg_net extension (enabled by default on Supabase)
-- These triggers call Edge Functions asynchronously after ticket/monitor changes.

-- Enable pg_net if not already enabled
create extension if not exists pg_net schema extensions;

-- ─── Ticket notification trigger ──────────────────────────────────────────────
-- Fires after INSERT or status UPDATE on tickets, calls notify-ticket edge function

create or replace function notify_ticket_event()
returns trigger as $$
declare
  event_type text;
  payload jsonb;
begin
  if TG_OP = 'INSERT' then
    event_type := 'created';
  else
    -- Only notify on status change
    if OLD.status = NEW.status then
      return NEW;
    end if;
    event_type := 'updated';
  end if;

  payload := jsonb_build_object(
    'ticket_id', NEW.id,
    'event', event_type,
    'status', NEW.status
  );

  perform net.http_post(
    url     := current_setting('app.supabase_url', true) || '/functions/v1/notify-ticket',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
               ),
    body    := payload
  );

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_ticket_notify on tickets;
create trigger on_ticket_notify
  after insert or update on tickets
  for each row execute function notify_ticket_event();

-- ─── Monitor down alert trigger ───────────────────────────────────────────────
-- Fires when a monitor's last_status transitions to 'down'

create or replace function notify_monitor_down_event()
returns trigger as $$
declare
  payload jsonb;
begin
  -- Only fire when transitioning TO 'down'
  if NEW.last_status = 'down' and (OLD.last_status is distinct from 'down') then
    payload := jsonb_build_object(
      'monitor_id',   NEW.id,
      'monitor_name', NEW.name,
      'target',       NEW.target,
      'checked_at',   NEW.last_checked_at
    );

    perform net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/notify-monitor-down',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
                 ),
      body    := payload
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_monitor_down_notify on monitors;
create trigger on_monitor_down_notify
  after update on monitors
  for each row execute function notify_monitor_down_event();

-- ─── App settings (supabase_url + anon_key for trigger use) ───────────────────
-- These are set at the project level via Supabase dashboard → Settings → Database → Config
-- Run these after deploying:
--   alter database postgres set app.supabase_url = 'https://yhdyuzdfocvtgyatnrqz.supabase.co';
--   alter database postgres set app.supabase_anon_key = '<anon_key>';
