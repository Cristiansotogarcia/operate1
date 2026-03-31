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

    const { data: monitors } = await supabase
      .from('monitors')
      .select('id, name, type, target, port, interval_seconds')
      .eq('device_id', deviceId)
      .eq('status', 'active')

    return json({ monitors: monitors || [] })
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
