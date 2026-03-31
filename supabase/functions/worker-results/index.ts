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

    if (!deviceId || !deviceSecret) return json({ error: 'Missing credentials' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: device } = await supabase
      .from('devices')
      .select('id, api_secret')
      .eq('id', deviceId)
      .single()

    if (!device || device.api_secret !== deviceSecret) return json({ error: 'Unauthorized' }, 401)

    const { monitor_id, status, response_ms, error_message } = await req.json()

    if (!monitor_id || !status) return json({ error: 'monitor_id and status required' }, 400)

    // Verify monitor belongs to this device
    const { data: monitor } = await supabase
      .from('monitors')
      .select('id')
      .eq('id', monitor_id)
      .eq('device_id', deviceId)
      .single()

    if (!monitor) return json({ error: 'Monitor not found for this device' }, 404)

    // Insert result
    await supabase.from('monitor_results').insert({
      monitor_id,
      status,
      response_ms: response_ms || null,
      error_message: error_message || null,
    })

    // Update monitor live status
    await supabase.from('monitors').update({
      last_status: status,
      last_checked_at: new Date().toISOString(),
    }).eq('id', monitor_id)

    // Recalculate stats
    await supabase.rpc('recalculate_monitor_stats', { p_monitor_id: monitor_id })

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
