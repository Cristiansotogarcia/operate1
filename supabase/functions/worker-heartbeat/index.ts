import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id, x-device-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const deviceId = req.headers.get('x-device-id')
    const deviceSecret = req.headers.get('x-device-secret')

    if (!deviceId || !deviceSecret) return json({ error: 'Missing device credentials' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate device credentials
    const { data: device, error } = await supabase
      .from('devices')
      .select('id, api_secret')
      .eq('id', deviceId)
      .single()

    if (error || !device || device.api_secret !== deviceSecret) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json()
    const {
      cpu_percent, ram_percent, disk_percent, ip_address,
      // Extended fields
      battery_percent, battery_charging, ac_connected, power_source,
      disk_type, disk_io_read_mb, disk_io_write_mb, smart_status, disk_temp_c,
      agent_version, shutdown_reason,
    } = body

    // Insert heartbeat record (with extended fields)
    await supabase.from('device_heartbeats').insert({
      device_id: deviceId,
      cpu_percent,
      ram_percent,
      disk_percent,
      ip_address,
      battery_percent: battery_percent ?? null,
      battery_charging: battery_charging ?? null,
      ac_connected: ac_connected ?? null,
      power_source: power_source ?? null,
      disk_io_read_mb: disk_io_read_mb ?? null,
      disk_io_write_mb: disk_io_write_mb ?? null,
    })

    // Build device update payload
    const deviceUpdate: Record<string, unknown> = {
      status: shutdown_reason ? 'offline' : 'online',
      last_seen_at: new Date().toISOString(),
      last_ip: ip_address,
      cpu_percent,
      ram_percent,
      disk_percent,
    }

    // Extended device fields (only set if provided)
    if (battery_percent !== undefined)  deviceUpdate.battery_percent = battery_percent
    if (battery_charging !== undefined) deviceUpdate.battery_charging = battery_charging
    if (ac_connected !== undefined)     deviceUpdate.ac_connected = ac_connected
    if (power_source)                   deviceUpdate.power_source = power_source
    if (disk_type)                      deviceUpdate.disk_type = disk_type
    if (disk_io_read_mb !== undefined)  deviceUpdate.disk_io_read_mb = disk_io_read_mb
    if (disk_io_write_mb !== undefined) deviceUpdate.disk_io_write_mb = disk_io_write_mb
    if (smart_status)                   deviceUpdate.smart_status = smart_status
    if (disk_temp_c !== undefined)      deviceUpdate.disk_temp_c = disk_temp_c
    if (agent_version)                  deviceUpdate.agent_version = agent_version
    if (shutdown_reason)                deviceUpdate.last_shutdown = shutdown_reason

    // If this is a fresh boot (no shutdown_reason), record boot time
    if (!shutdown_reason) {
      const uptime = Deno.osUptime?.() // Deno 1.36+
      if (uptime) {
        deviceUpdate.last_boot_at = new Date(Date.now() - uptime * 1000).toISOString()
      }
    }

    await supabase.from('devices').update(deviceUpdate).eq('id', deviceId)

    return json({ ok: true })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
