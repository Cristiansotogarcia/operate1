import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Plus, Mail, Webhook, Trash2, Edit2, AlertCircle, Play } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { EmailRoute, WebhookConfig, TicketType, Company, WebhookProvider } from '@operate1/types'
import toast from 'react-hot-toast'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const WEBHOOK_EVENTS = [
  'ticket.created',
  'ticket.status_changed',
  'ticket.assigned',
  'monitor.status_changed',
  'device.went_offline',
  'device.came_online',
]

export function IntegrationsPage() {
  const [tab, setTab] = useState<'email' | 'webhooks'>('email')
  const [routes, setRoutes] = useState<EmailRoute[]>([])
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  // Email route modal
  const [routeModal, setRouteModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<EmailRoute | null>(null)
  const [routeForm, setRouteForm] = useState({ inbound_address: '', company_id: '', ticket_type_id: '', default_status: 'pending', is_active: true })
  const [savingRoute, setSavingRoute] = useState(false)
  const [deleteRoute, setDeleteRoute] = useState<EmailRoute | null>(null)
  // Webhook modal
  const [whModal, setWhModal] = useState(false)
  const [editingWh, setEditingWh] = useState<WebhookConfig | null>(null)
  const [whForm, setWhForm] = useState({ name: '', url: '', provider: 'generic' as WebhookProvider, events: ['ticket.created'], is_active: true, secret: '' })
  const [savingWh, setSavingWh] = useState(false)
  const [deleteWh, setDeleteWh] = useState<WebhookConfig | null>(null)
  const [testingWhIds, setTestingWhIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: w }, { data: tt }, { data: co }] = await Promise.all([
      supabase.from('email_routes').select('*, company:companies(name), ticket_type:ticket_types(name)').order('created_at', { ascending: false }),
      supabase.from('webhook_configs').select('*').order('created_at', { ascending: false }),
      supabase.from('ticket_types').select('id,name').order('name'),
      supabase.from('companies').select('id,name').eq('status', 'active').order('name'),
    ])
    setRoutes((r ?? []) as EmailRoute[])
    setWebhooks((w ?? []) as WebhookConfig[])
    setTicketTypes((tt ?? []) as TicketType[])
    setCompanies((co ?? []) as Company[])
    setLoading(false)
  }

  // ─── Email Routes ───────────────────────────────────────────
  function openCreateRoute() {
    setEditingRoute(null)
    setRouteForm({ inbound_address: '', company_id: '', ticket_type_id: '', default_status: 'pending', is_active: true })
    setRouteModal(true)
  }

  function openEditRoute(r: EmailRoute) {
    setEditingRoute(r)
    setRouteForm({
      inbound_address: r.inbound_address,
      company_id: r.company_id ?? '',
      ticket_type_id: r.ticket_type_id ?? '',
      default_status: r.default_status,
      is_active: r.is_active,
    })
    setRouteModal(true)
  }

  async function saveRoute() {
    if (!routeForm.inbound_address.trim()) return
    setSavingRoute(true)
    const payload = {
      tenant_id: TENANT_ID,
      inbound_address: routeForm.inbound_address.trim().toLowerCase(),
      company_id: routeForm.company_id || null,
      ticket_type_id: routeForm.ticket_type_id || null,
      default_status: routeForm.default_status,
      is_active: routeForm.is_active,
    }
    if (editingRoute) {
      await supabase.from('email_routes').update(payload).eq('id', editingRoute.id)
    } else {
      await supabase.from('email_routes').insert(payload)
    }
    setSavingRoute(false)
    setRouteModal(false)
    fetchAll()
    toast.success(editingRoute ? 'Route updated' : 'Route created')
  }

  async function confirmDeleteRoute() {
    if (!deleteRoute) return
    await supabase.from('email_routes').delete().eq('id', deleteRoute.id)
    setDeleteRoute(null)
    fetchAll()
  }

  // ─── Webhooks ───────────────────────────────────────────────
  function openCreateWh() {
    setEditingWh(null)
    setWhForm({ name: '', url: '', provider: 'generic', events: ['ticket.created'], is_active: true, secret: '' })
    setWhModal(true)
  }

  function openEditWh(w: WebhookConfig) {
    setEditingWh(w)
    setWhForm({ name: w.name, url: w.url, provider: w.provider, events: [...w.events], is_active: w.is_active, secret: w.secret ?? '' })
    setWhModal(true)
  }

  async function saveWh() {
    if (!whForm.name.trim() || !whForm.url.trim()) return
    setSavingWh(true)
    const payload = {
      tenant_id: TENANT_ID,
      name: whForm.name.trim(),
      url: whForm.url.trim(),
      provider: whForm.provider,
      events: whForm.events,
      is_active: whForm.is_active,
      secret: whForm.secret.trim() || null,
    }
    if (editingWh) {
      await supabase.from('webhook_configs').update(payload).eq('id', editingWh.id)
    } else {
      await supabase.from('webhook_configs').insert(payload)
    }
    setSavingWh(false)
    setWhModal(false)
    fetchAll()
    toast.success(editingWh ? 'Webhook updated' : 'Webhook created')
  }

  async function confirmDeleteWh() {
    if (!deleteWh) return
    await supabase.from('webhook_configs').delete().eq('id', deleteWh.id)
    setDeleteWh(null)
    fetchAll()
  }

  async function testWebhook(w: WebhookConfig) {
    setTestingWhIds(s => new Set(s).add(w.id))
    try {
      const { data, error } = await supabase.functions.invoke('send-webhook', {
        body: {
          event: 'ticket.created',
          entity_type: 'ticket',
          entity_id: 'test-ping',
          payload: { ticket_number: 'TEST-001', subject: 'Webhook connectivity test from Operate1', status: 'open' },
          target_webhook_id: w.id,
        },
      })
      if (error) throw error
      const result = data as { dispatched?: number; failed?: number }
      if (result?.failed) {
        toast.error(`Test delivered but webhook returned an error`)
      } else {
        toast.success(`Test sent to "${w.name}"`)
      }
    } catch (err: unknown) {
      toast.error(`Could not reach webhook: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setTestingWhIds(s => { const n = new Set(s); n.delete(w.id); return n })
    }
  }

  function toggleEvent(ev: string) {
    setWhForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  const rf = (field: string, val: unknown) => setRouteForm(f => ({ ...f, [field]: val }))

  return (
    <div className="p-6">
      <PageHeader
        title="Integrations"
        subtitle="Email routing and outbound webhooks"
      />

      {/* Note about Resend */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <strong>Email routing requires Resend.</strong> Add <code>RESEND_WEBHOOK_SECRET</code> to Supabase Edge Function secrets and configure an inbound email domain in Resend to activate email-to-ticket. Webhook delivery requires deploying the <code>send-webhook</code> edge function.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('email')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === 'email' ? 'border-b-2 border-cyan-600 text-cyan-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Mail size={14} className="inline mr-1.5" />Email Routes ({routes.length})
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === 'webhooks' ? 'border-b-2 border-cyan-600 text-cyan-700' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Webhook size={14} className="inline mr-1.5" />Webhooks ({webhooks.length})
        </button>
      </div>

      {/* Email Routes */}
      {tab === 'email' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={openCreateRoute}><Plus size={14} className="mr-1" />New Route</Button>
          </div>
          {routes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No email routes configured.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Inbound Address</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ticket Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Default Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {routes.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm text-cyan-600">{r.inbound_address}</td>
                      <td className="px-4 py-3 text-gray-600">{r.company?.name ?? <span className="text-gray-300">Any</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{r.ticket_type?.name ?? <span className="text-gray-300">None</span>}</td>
                      <td className="px-4 py-3"><Badge variant="gray">{r.default_status}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={r.is_active ? 'success' : 'gray'}>{r.is_active ? 'Yes' : 'No'}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEditRoute(r)} className="text-gray-400 hover:text-cyan-600"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteRoute(r)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Webhooks */}
      {tab === 'webhooks' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={openCreateWh}><Plus size={14} className="mr-1" />New Webhook</Button>
          </div>
          {webhooks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No webhooks configured.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Provider</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Events</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Created</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {webhooks.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{w.name}</td>
                      <td className="px-4 py-3"><Badge variant="info">{w.provider}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {w.events.map(e => <Badge key={e} variant="gray" className="text-xs">{e}</Badge>)}
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge variant={w.is_active ? 'success' : 'gray'}>{w.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDateTime(w.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => testWebhook(w)}
                            disabled={testingWhIds.has(w.id)}
                            title="Send test ping"
                            className="text-gray-400 hover:text-green-600 disabled:opacity-40"
                          >
                            <Play size={14} />
                          </button>
                          <button onClick={() => openEditWh(w)} className="text-gray-400 hover:text-cyan-600"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleteWh(w)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Email route modal */}
      <Modal
        open={routeModal}
        onClose={() => setRouteModal(false)}
        title={editingRoute ? 'Edit Email Route' : 'New Email Route'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRouteModal(false)}>Cancel</Button>
            <Button onClick={saveRoute} disabled={savingRoute || !routeForm.inbound_address.trim()}>
              {savingRoute ? 'Saving…' : editingRoute ? 'Save Changes' : 'Create Route'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Inbound Email Address"
            value={routeForm.inbound_address}
            onChange={e => rf('inbound_address', e.target.value)}
            placeholder="support@tickets.yourdomain.com"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company (optional)</label>
            <select value={routeForm.company_id} onChange={e => rf('company_id', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="">Any company</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Type (optional)</label>
            <select value={routeForm.ticket_type_id} onChange={e => rf('ticket_type_id', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="">None</option>
              {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Status</label>
            <select value={routeForm.default_status} onChange={e => rf('default_status', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="pending">Pending</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={routeForm.is_active} onChange={e => rf('is_active', e.target.checked)} className="rounded border-gray-300" />
            Active
          </label>
        </div>
      </Modal>

      {/* Webhook modal */}
      <Modal
        open={whModal}
        onClose={() => setWhModal(false)}
        title={editingWh ? 'Edit Webhook' : 'New Webhook'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setWhModal(false)}>Cancel</Button>
            <Button onClick={saveWh} disabled={savingWh || !whForm.name.trim() || !whForm.url.trim()}>
              {savingWh ? 'Saving…' : editingWh ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={whForm.name} onChange={e => setWhForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Slack Alerts" />
          <Input label="URL" value={whForm.url} onChange={e => setWhForm(f => ({...f, url: e.target.value}))} placeholder="https://hooks.slack.com/…" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
            <select value={whForm.provider} onChange={e => setWhForm(f => ({...f, provider: e.target.value as WebhookProvider}))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
              <option value="generic">Generic (JSON POST)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
            <div className="space-y-1.5">
              {WEBHOOK_EVENTS.map(ev => (
                <label key={ev} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={whForm.events.includes(ev)} onChange={() => toggleEvent(ev)} className="rounded border-gray-300" />
                  <code className="text-xs text-gray-600">{ev}</code>
                </label>
              ))}
            </div>
          </div>
          <Input label="Signing Secret (optional)" value={whForm.secret} onChange={e => setWhForm(f => ({...f, secret: e.target.value}))} placeholder="Used to verify webhook authenticity" />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={whForm.is_active} onChange={e => setWhForm(f => ({...f, is_active: e.target.checked}))} className="rounded border-gray-300" />
            Active
          </label>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteRoute} onClose={() => setDeleteRoute(null)} onConfirm={confirmDeleteRoute}
        title="Delete Email Route" message={`Delete route for "${deleteRoute?.inbound_address}"?`} />
      <ConfirmDialog open={!!deleteWh} onClose={() => setDeleteWh(null)} onConfirm={confirmDeleteWh}
        title="Delete Webhook" message={`Delete webhook "${deleteWh?.name}"?`} />
    </div>
  )
}
