// notify-ticket — called after ticket insert/update to email the contact
// Expects POST body: { ticket_id, event: 'created' | 'updated', status? }
// Requires env vars: RESEND_API_KEY, TICKET_EMAIL_FROM, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('TICKET_EMAIL_FROM') ?? 'helpdesk@operate1.dev'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: { ticket_id?: string; event?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { ticket_id, event } = body
  if (!ticket_id || !event) {
    return new Response('Missing ticket_id or event', { status: 400 })
  }

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email')
    return new Response(JSON.stringify({ skipped: true, reason: 'no API key' }), { status: 200 })
  }

  // Fetch ticket details using service role
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, company:companies(name), ticket_type:ticket_types(name)')
    .eq('id', ticket_id)
    .single()

  if (error || !ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found' }), { status: 404 })
  }

  const isCreated = event === 'created'
  const subject = isCreated
    ? `[${ticket.ticket_number}] Your ticket has been received — ${ticket.subject}`
    : `[${ticket.ticket_number}] Ticket updated — ${ticket.subject}`

  const statusLabel = ticket.status.replace('_', ' ')
  const companyName = (ticket.company as any)?.name ?? ''

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#4c1d95;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">${isCreated ? '🎫 Ticket Created' : '🔄 Ticket Updated'}</h2>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin-top:0">Hi ${ticket.contact_name || ticket.contact_email},</p>
        <p>${isCreated
          ? 'We have received your support request and will be in touch shortly.'
          : 'Your support ticket has been updated.'}
        </p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px">Ticket #</td><td style="padding:8px 0;font-weight:600">${ticket.ticket_number}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Subject</td><td style="padding:8px 0">${ticket.subject}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Status</td><td style="padding:8px 0"><span style="background:#ede9fe;color:#4c1d95;padding:2px 8px;border-radius:4px;font-size:13px;font-weight:600;text-transform:capitalize">${statusLabel}</span></td></tr>
          ${companyName ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Company</td><td style="padding:8px 0">${companyName}</td></tr>` : ''}
        </table>
        <p style="font-size:13px;color:#9ca3af;margin-bottom:0">Xatech Helpdesk — Operate1</p>
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
      to: [ticket.contact_email],
      subject,
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
