// device-pair — Pairs an agent with a device using a short pairing code.
// Called by the Electron agent on first run.
// Uses service role key to bypass RLS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { code, hostname, os, os_version } = await req.json()

    if (!code || typeof code !== 'string') {
      return json({ error: 'Pairing code is required' }, 400)
    }

    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '')

    // Look up the pairing code
    const { data: pairing, error: lookupErr } = await supabase
      .from('pairing_codes')
      .select('*')
      .eq('code', cleanCode)
      .single()

    if (lookupErr || !pairing) {
      return json({ error: 'Invalid pairing code' }, 404)
    }

    // Check if already claimed
    if (pairing.claimed_at) {
      return json({ error: 'This pairing code has already been used' }, 409)
    }

    // Check expiry
    if (new Date(pairing.expires_at) < new Date()) {
      return json({ error: 'This pairing code has expired' }, 410)
    }

    // Generate a 64-char hex api_secret
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const apiSecret = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')

    // Update the device with agent info
    const { error: deviceErr } = await supabase
      .from('devices')
      .update({
        api_secret: apiSecret,
        computer_name: hostname || null,
        os: os || null,
        status: 'online',
        last_seen_at: new Date().toISOString(),
        company_id: pairing.company_id,
        site_id: pairing.site_id,
      })
      .eq('id', pairing.device_id)

    if (deviceErr) throw deviceErr

    // Mark pairing code as claimed
    await supabase
      .from('pairing_codes')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', pairing.id)

    return json({
      device_id: pairing.device_id,
      api_secret: apiSecret,
      heartbeat_interval_ms: 30000,
    })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
