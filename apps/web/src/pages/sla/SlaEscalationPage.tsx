import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { SlaEscalationRule, SlaPolicy, EscalationTrigger, EscalationAction, Profile } from '@operate1/types'

const TRIGGER_OPTIONS: { value: EscalationTrigger; label: string }[] = [
  { value: 'response_warning', label: 'Response Warning' },
  { value: 'response_breach', label: 'Response Breach' },
  { value: 'resolve_warning', label: 'Resolve Warning' },
  { value: 'resolve_breach', label: 'Resolve Breach' },
]

const ACTION_OPTIONS: { value: EscalationAction; label: string }[] = [
  { value: 'notify', label: 'Send Notification' },
  { value: 'reassign', label: 'Reassign Ticket' },
  { value: 'change_priority', label: 'Change Priority' },
  { value: 'add_comment', label: 'Add Comment' },
]

export function SlaEscalationPage() {
  const [rules, setRules] = useState<SlaEscalationRule[]>([])
  const [policies, setPolicies] = useState<SlaPolicy[]>([])
  const [admins, setAdmins] = useState<Pick<Profile, 'id' | 'full_name' | 'username'>[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SlaEscalationRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', sla_policy_id: '', trigger_type: 'response_warning' as EscalationTrigger,
    trigger_percent: 80, action_type: 'notify' as EscalationAction,
    action_config: {} as Record<string, string>, is_active: true,
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: r }, { data: p }, { data: a }] = await Promise.all([
      supabase.from('sla_escalation_rules').select('*, sla_policy:sla_policies(name)').order('name'),
      supabase.from('sla_policies').select('*').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, full_name, username').eq('role', 'admin').eq('status', 'active'),
    ])
    setRules((r as SlaEscalationRule[]) || [])
    setPolicies((p as SlaPolicy[]) || [])
    setAdmins(a || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', sla_policy_id: '', trigger_type: 'response_warning', trigger_percent: 80, action_type: 'notify', action_config: {}, is_active: true })
    setModalOpen(true)
  }

  function openEdit(r: SlaEscalationRule) {
    setEditing(r)
    setForm({
      name: r.name, sla_policy_id: r.sla_policy_id, trigger_type: r.trigger_type,
      trigger_percent: r.trigger_percent, action_type: r.action_type,
      action_config: (r.action_config as Record<string, string>) || {}, is_active: r.is_active,
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sla_policy_id) { toast.error('Select an SLA policy'); return }
    setSaving(true)
    const payload = {
      name: form.name,
      sla_policy_id: form.sla_policy_id,
      trigger_type: form.trigger_type,
      trigger_percent: form.trigger_percent,
      action_type: form.action_type,
      action_config: form.action_config,
      is_active: form.is_active,
    }
    if (editing) {
      const { error } = await supabase.from('sla_escalation_rules').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Rule updated')
    } else {
      const { error } = await supabase.from('sla_escalation_rules').insert({ ...payload, tenant_id: TENANT_ID })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Rule created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('sla_escalation_rules').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Rule deleted')
    fetchAll()
  }

  const triggerLabel = (t: string) => TRIGGER_OPTIONS.find(o => o.value === t)?.label ?? t
  const actionLabel = (a: string) => ACTION_OPTIONS.find(o => o.value === a)?.label ?? a
  const triggerColor = (t: string) => t.includes('breach') ? 'danger' : 'warning'

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="SLA Escalation Rules" count={rules.length} countLabel="rule(s)"
        actions={<Button size="sm" onClick={openCreate}>New Rule</Button>} />

      {rules.length === 0 ? <EmptyState title="No escalation rules" description="Create rules to auto-escalate tickets when SLA deadlines approach" /> : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} className="text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{r.name}</h3>
                      {!r.is_active && <Badge variant="gray">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Policy: {(r as any).sla_policy?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Badge variant={triggerColor(r.trigger_type)}>{triggerLabel(r.trigger_type)} at {r.trigger_percent}%</Badge>
                <Badge variant="info">{actionLabel(r.action_type)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Escalation Rule' : 'New Escalation Rule'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Notify manager at 80%"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SLA Policy *</label>
              <select required value={form.sla_policy_id} onChange={e => setForm(f => ({ ...f, sla_policy_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select policy</option>
                {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger</label>
              <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as EscalationTrigger }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                {TRIGGER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">At % of deadline</label>
              <input type="number" min={1} max={100} value={form.trigger_percent}
                onChange={e => setForm(f => ({ ...f, trigger_percent: parseInt(e.target.value) || 80 }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value as EscalationAction }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {form.action_type === 'reassign' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reassign To</label>
              <select value={form.action_config.reassign_to || ''}
                onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, reassign_to: e.target.value } }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select user</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.full_name || a.username}</option>)}
              </select>
            </div>
          )}

          {form.action_type === 'change_priority' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Priority</label>
              <select value={form.action_config.new_priority || ''}
                onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, new_priority: e.target.value } }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          )}

          {form.action_type === 'add_comment' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment Text</label>
              <textarea rows={2} value={form.action_config.comment || ''}
                onChange={e => setForm(f => ({ ...f, action_config: { ...f.action_config, comment: e.target.value } }))}
                placeholder="e.g. SLA deadline approaching — please prioritize this ticket."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-violet-600" />
            Active
          </label>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Rule" message="Are you sure you want to delete this escalation rule?" />
    </div>
  )
}
