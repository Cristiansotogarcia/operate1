// notify-monitor-down — called by a Postgres trigger or pg_cron when a monitor transitions to 'down'
// Expects POST body: { monitor_id, monitor_name, target, checked_at }
// Requires env vars: RESEND_API_KEY, ALERT_EMAIL_TO, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const ALERT_EMAIL_TO = Deno.env.get('ALERT_EMAIL_TO') ?? ''
const FROM_EMAIL = Deno.env.get('ALERT_EMAIL_FROM') ?? 'alerts@operate1.dev'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { monitor_id?: string; monitor_name?: string; target?: string; checked_at?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { monitor_name, target, checked_at } = body
  if (!monitor_name || !target) {
    return new Response('Missing monitor_name or target', { status: 400 })
  }

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return new Response(JSON.stringify({ skipped: true, reason: 'no API key' }), { status: 200 })
  }

  if (!ALERT_EMAIL_TO) {
    console.warn('ALERT_EMAIL_TO not set — skipping email')
    return new Response(JSON.stringify({ skipped: true, reason: 'no recipient' }), { status: 200 })
  }

  const checkedAt = checked_at ? new Date(checked_at).toUTCString() : new Date().toUTCString()

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#dc2626;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">⚠️ Monitor Down Alert</h2>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Monitor</td><td style="padding:8px 0;font-weight:600">${monitor_name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Target</td><td style="padding:8px 0">${target}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Status</td><td style="padding:8px 0"><span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:600">DOWN</span></td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Detected at</td><td style="padding:8px 0">${checkedAt}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:13px;color:#9ca3af">This alert was sent by Xatech Helpdesk — Operate1.</p>
      </div>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ALERT_EMAIL_TO],
      subject: `[DOWN] ${monitor_name} — ${target}`,
      html,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    console.error('Resend error:', data)
    return new Response(JSON.stringify({ error: data }), { status: 500 })
  }

  return new Response(JSON.stringify({ sent: true, id: data.id }), { status: 200 })
})
