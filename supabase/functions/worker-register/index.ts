import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { registration_key, computer_name, os, ip_address } = await req.json()

    if (!registration_key) {
      return json({ error: 'registration_key required' }, 400)
    }

    const { data: device, error } = await supabase
      .from('devices')
      .select('*')
      .eq('registration_key', registration_key)
      .single()

    if (error || !device) return json({ error: 'Invalid registration key' }, 404)

    if (device.api_secret && device.api_secret !== 'pending') {
      return json({ error: 'Registration key already used' }, 409)
    }

    // Generate a secure api_secret
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const apiSecret = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')

    const { error: updateErr } = await supabase
      .from('devices')
      .update({
        api_secret: apiSecret,
        computer_name: computer_name || null,
        os: os || null,
        last_ip: ip_address || null,
        status: 'online',
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', device.id)

    if (updateErr) throw updateErr

    return json({ device_id: device.id, api_secret: apiSecret })
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
