import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2, Mail, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import type { EmailTemplate } from '@operate1/types'

const EVENT_OPTIONS = [
  { value: 'ticket.created', label: 'Ticket Created' },
  { value: 'ticket.updated', label: 'Ticket Updated' },
  { value: 'ticket.resolved', label: 'Ticket Resolved' },
  { value: 'ticket.closed', label: 'Ticket Closed' },
  { value: 'ticket.comment', label: 'New Comment' },
  { value: 'sla.warning', label: 'SLA Warning' },
  { value: 'sla.breach', label: 'SLA Breach' },
  { value: 'monitor.down', label: 'Monitor Down' },
  { value: 'monitor.up', label: 'Monitor Recovered' },
]

export function EmailTemplatesPage() {
  const [rows, setRows] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', event: 'ticket.created', subject_template: '', body_html: '', is_active: true,
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('email_templates').select('*').order('event')
    setRows((data as EmailTemplate[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', event: 'ticket.created', subject_template: '', body_html: '', is_active: true })
    setModalOpen(true)
  }

  function openEdit(r: EmailTemplate) {
    setEditing(r)
    setForm({ name: r.name, event: r.event, subject_template: r.subject_template, body_html: r.body_html, is_active: r.is_active })
    setModalOpen(true)
  }

  function preview(r: EmailTemplate) {
    const sample = r.body_html
      .replace(/\{\{ticket_number\}\}/g, 'TK-0042')
      .replace(/\{\{subject\}\}/g, 'VPN not connecting')
      .replace(/\{\{status\}\}/g, 'Open')
      .replace(/\{\{priority\}\}/g, 'High')
      .replace(/\{\{contact_email\}\}/g, 'user@example.com')
      .replace(/\{\{description\}\}/g, 'Unable to connect to the company VPN since this morning. Error: timeout.')
      .replace(/\{\{sla_name\}\}/g, 'Standard SLA')
      .replace(/\{\{trigger_type\}\}/g, 'Response')
      .replace(/\{\{trigger_percent\}\}/g, '90')
    setPreviewHtml(sample)
    setPreviewOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      event: form.event,
      subject_template: form.subject_template,
      body_html: form.body_html,
      is_active: form.is_active,
    }
    if (editing) {
      const { error } = await supabase.from('email_templates').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Template updated')
    } else {
      const { error } = await supabase.from('email_templates').insert({ ...payload, tenant_id: TENANT_ID })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Template created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('email_templates').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Template deleted')
    fetchAll()
  }

  const eventLabel = (ev: string) => EVENT_OPTIONS.find(o => o.value === ev)?.label ?? ev

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Email Templates" count={rows.length} countLabel="template(s)"
        actions={<Button size="sm" onClick={openCreate}>New Template</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm text-gray-500">
          Use placeholders in subject and body: <code className="text-cyan-600 bg-cyan-50 px-1 rounded text-xs">{'{{ticket_number}}'}</code>,{' '}
          <code className="text-cyan-600 bg-cyan-50 px-1 rounded text-xs">{'{{subject}}'}</code>,{' '}
          <code className="text-cyan-600 bg-cyan-50 px-1 rounded text-xs">{'{{status}}'}</code>,{' '}
          <code className="text-cyan-600 bg-cyan-50 px-1 rounded text-xs">{'{{priority}}'}</code>,{' '}
          <code className="text-cyan-600 bg-cyan-50 px-1 rounded text-xs">{'{{contact_email}}'}</code>,{' '}
          <code className="text-cyan-600 bg-cyan-50 px-1 rounded text-xs">{'{{description}}'}</code>
        </p>
      </div>

      {rows.length === 0 ? <EmptyState title="No email templates" description="Create templates for automated email notifications" /> : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <Mail size={20} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900">{r.name}</h3>
                      <Badge variant="info">{eventLabel(r.event)}</Badge>
                      {!r.is_active && <Badge variant="gray">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{r.subject_template}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => preview(r)} className="p-1.5 text-gray-400 hover:text-cyan-600" title="Preview"><Eye size={15} /></button>
                  <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-amber-600" title="Edit"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Email Template' : 'New Email Template'} size="xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event *</label>
              <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                {EVENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Template *</label>
            <input required value={form.subject_template} onChange={e => setForm(f => ({ ...f, subject_template: e.target.value }))}
              placeholder="Ticket {{ticket_number}} — {{subject}}"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HTML Body *</label>
            <textarea required rows={12} value={form.body_html} onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-cyan-600" />
            Active
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Preview modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Email Preview" size="lg">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Template" message="Are you sure you want to delete this email template?" />
    </div>
  )
}
