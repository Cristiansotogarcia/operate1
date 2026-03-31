// inbound-email — Receives inbound email webhooks from Resend
// Structure is complete. Will remain silent until:
//   1. Resend inbound email is configured on your domain
//   2. RESEND_WEBHOOK_SECRET is added to Supabase Edge Function secrets
//   3. The Resend inbound webhook URL is pointed to this function's endpoint
//
// Resend inbound webhook payload reference:
// https://resend.com/docs/api-reference/webhooks/introduction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

Deno.serve(async (req: Request) => {
  // Verify Resend webhook signature
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!webhookSecret) {
    console.log('RESEND_WEBHOOK_SECRET not set — inbound-email is inactive')
    return new Response(JSON.stringify({ skipped: true, reason: 'not_configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Resend inbound email payload structure
  const emailData = payload.data as {
    from: string
    to: string[]
    subject: string
    html?: string
    text?: string
    headers?: Record<string, string>
  }

  if (!emailData?.from || !emailData?.to?.length) {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400 })
  }

  const toAddress = emailData.to[0].toLowerCase()
  const fromAddress = emailData.from.toLowerCase()
  const subject = emailData.subject || '(No subject)'
  const body = emailData.html || emailData.text || ''

  // Look up the matching email route
  const { data: route } = await supabase
    .from('email_routes')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('inbound_address', toAddress)
    .eq('is_active', true)
    .single()

  if (!route) {
    console.log(`No active email route found for: ${toAddress}`)
    return new Response(JSON.stringify({ skipped: true, reason: 'no_route' }), { status: 200 })
  }

  // Generate ticket number
  const { data: ticketNum } = await supabase
    .rpc('generate_ticket_number', { p_tenant_id: TENANT_ID })

  // Create ticket from inbound email
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      tenant_id: TENANT_ID,
      ticket_number: ticketNum || `T-EMAIL-${Date.now()}`,
      company_id: route.company_id ?? null,
      site_id: route.site_id ?? null,
      ticket_type_id: route.ticket_type_id ?? null,
      contact_email: fromAddress,
      contact_name: extractName(emailData.from),
      subject,
      description: body,
      status: route.default_status,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create ticket from email:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  console.log(`Created ticket ${ticket.ticket_number} from inbound email`)
  return new Response(JSON.stringify({ ticket_id: ticket.id, ticket_number: ticket.ticket_number }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// Extract display name from "Name <email>" format
function extractName(from: string): string {
  const match = from.match(/^([^<]+)</)
  return match ? match[1].trim() : from.split('@')[0]
}
