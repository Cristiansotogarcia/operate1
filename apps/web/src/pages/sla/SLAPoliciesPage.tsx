import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { Plus, Edit2, Trash2, Shield } from 'lucide-react'
import type { SlaPolicy, TicketType, TicketPriority } from '@operate1/types'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const PRIORITY_COLORS: Record<TicketPriority, 'gray' | 'info' | 'warning' | 'danger'> = {
  low: 'gray', normal: 'info', high: 'warning', critical: 'danger',
}

function minutesToLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

interface FormState {
  name: string
  ticket_type_id: string
  priority: TicketPriority
  response_minutes: number
  resolve_minutes: number
  is_active: boolean
}

const DEFAULT_FORM: FormState = {
  name: '',
  ticket_type_id: '',
  priority: 'normal',
  response_minutes: 480,
  resolve_minutes: 2880,
  is_active: true,
}

export function SLAPoliciesPage() {
  const [policies, setPolicies] = useState<SlaPolicy[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SlaPolicy | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SlaPolicy | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: polData }, { data: ttData }] = await Promise.all([
      supabase
        .from('sla_policies')
        .select('*, ticket_type:ticket_types(id,name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('ticket_types')
        .select('id,name')
        .order('name'),
    ])
    setPolicies((polData ?? []) as SlaPolicy[])
    setTicketTypes((ttData ?? []) as TicketType[])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setModalOpen(true)
  }

  function openEdit(p: SlaPolicy) {
    setEditing(p)
    setForm({
      name: p.name,
      ticket_type_id: p.ticket_type_id ?? '',
      priority: p.priority,
      response_minutes: p.response_minutes,
      resolve_minutes: p.resolve_minutes,
      is_active: p.is_active,
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      tenant_id: TENANT_ID,
      name: form.name.trim(),
      ticket_type_id: form.ticket_type_id || null,
      priority: form.priority,
      response_minutes: form.response_minutes,
      resolve_minutes: form.resolve_minutes,
      is_active: form.is_active,
    }
    if (editing) {
      await supabase.from('sla_policies').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('sla_policies').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    fetchAll()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('sla_policies').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    fetchAll()
  }

  const f = (field: keyof FormState, val: unknown) =>
    setForm(prev => ({ ...prev, [field]: val }))

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="p-6">
      <PageHeader
        title="SLA Policies"
        subtitle="Define response and resolution time targets per ticket type"
        actions={<Button onClick={openCreate}><Plus size={16} className="mr-1" />New Policy</Button>}
      />

      {policies.length === 0 ? (
        <EmptyState
          title="No SLA policies"
          description="Create policies to track response and resolution time targets."
          action={<Button onClick={openCreate}><Plus size={16} className="mr-1" />New Policy</Button>}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ticket Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">First Response</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Resolution</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {policies.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.ticket_type?.name ?? <span className="text-gray-400">Any</span>}</td>
                  <td className="px-4 py-3">
                    <Badge variant={PRIORITY_COLORS[p.priority]}>{p.priority}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{minutesToLabel(p.response_minutes)}</td>
                  <td className="px-4 py-3 text-gray-700">{minutesToLabel(p.resolve_minutes)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.is_active ? 'success' : 'gray'}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-cyan-600"><Edit2 size={15} /></button>
                      <button onClick={() => setDeleteTarget(p)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit SLA Policy' : 'New SLA Policy'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Policy Name"
            value={form.name}
            onChange={e => f('name', e.target.value)}
            placeholder="e.g. Standard Support SLA"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Type</label>
            <select
              value={form.ticket_type_id}
              onChange={e => f('ticket_type_id', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Any ticket type</option>
              {ticketTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={e => f('priority', e.target.value as TicketPriority)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Response (minutes)</label>
              <input
                type="number"
                min={1}
                value={form.response_minutes}
                onChange={e => f('response_minutes', parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-gray-400 mt-1">= {minutesToLabel(form.response_minutes)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution (minutes)</label>
              <input
                type="number"
                min={1}
                value={form.resolve_minutes}
                onChange={e => f('resolve_minutes', parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-gray-400 mt-1">= {minutesToLabel(form.resolve_minutes)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="sla-active"
              type="checkbox"
              checked={form.is_active}
              onChange={e => f('is_active', e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="sla-active" className="text-sm text-gray-700">Active</label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete SLA Policy"
        message={`Delete "${deleteTarget?.name}"? This will not affect existing tickets.`}
        loading={deleting}
      />
    </div>
  )
}
