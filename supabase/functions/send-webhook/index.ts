// send-webhook — Fires outbound webhooks to Slack / Teams / generic endpoints
// Called from Postgres triggers or directly via HTTP POST from the web app.
// Payload format is Slack-compatible by default; Teams uses AdaptiveCard format.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

interface WebhookBody {
  event: string          // e.g. 'ticket.created'
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  // Load all active webhook configs that subscribe to this event
  const { data: configs } = await supabase
    .from('webhook_configs')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .contains('events', [body.event])

  if (!configs?.length) {
    return new Response(JSON.stringify({ dispatched: 0 }), { status: 200 })
  }

  const results = await Promise.allSettled(
    configs.map(async (config) => {
      const message = buildMessage(config.provider, body)
      const resp = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${config.url}`)
    })
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed    = results.filter(r => r.status === 'rejected').length

  return new Response(JSON.stringify({ dispatched: succeeded, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

function buildMessage(provider: string, body: WebhookBody): Record<string, unknown> {
  const text = formatEventText(body)

  if (provider === 'slack') {
    return { text }
  }

  if (provider === 'teams') {
    return {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [{ type: 'TextBlock', text, wrap: true }],
        },
      }],
    }
  }

  // Generic
  return { event: body.event, entity_type: body.entity_type, entity_id: body.entity_id, payload: body.payload, text }
}

function formatEventText(body: WebhookBody): string {
  const p = body.payload as Record<string, string>
  switch (body.event) {
    case 'ticket.created':
      return `🎫 New ticket ${p.ticket_number}: ${p.subject} (${p.status})`
    case 'ticket.status_changed':
      return `🔄 Ticket ${p.ticket_number} status changed to ${p.new_status}`
    case 'monitor.status_changed':
      return `🔴 Monitor "${p.name}" is now ${p.last_status}`
    case 'device.went_offline':
      return `⚠️ Device "${p.name}" went offline`
    default:
      return `Operate1 event: ${body.event}`
  }
}
