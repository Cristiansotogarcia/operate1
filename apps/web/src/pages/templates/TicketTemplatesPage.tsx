import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2, Copy, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TicketTemplate, TicketType, Company } from '@operate1/types'

export function TicketTemplatesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<TicketTemplate[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TicketTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', subject: '', description: '', priority: 'normal',
    ticket_type_id: '', company_id: '', is_active: true,
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: t }, { data: tt }, { data: co }] = await Promise.all([
      supabase.from('ticket_templates').select('*, ticket_type:ticket_types(name), company:companies(name)').order('name'),
      supabase.from('ticket_types').select('*').order('name'),
      supabase.from('companies').select('id, name').eq('status', 'active').order('name'),
    ])
    setRows((t as TicketTemplate[]) || [])
    setTicketTypes(tt || [])
    setCompanies((co as Company[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', subject: '', description: '', priority: 'normal', ticket_type_id: '', company_id: '', is_active: true })
    setModalOpen(true)
  }

  function openEdit(r: TicketTemplate) {
    setEditing(r)
    setForm({
      name: r.name, subject: r.subject || '', description: r.description || '',
      priority: r.priority, ticket_type_id: r.ticket_type_id || '',
      company_id: r.company_id || '', is_active: r.is_active,
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      subject: form.subject || null,
      description: form.description || null,
      priority: form.priority,
      ticket_type_id: form.ticket_type_id || null,
      company_id: form.company_id || null,
      is_active: form.is_active,
    }
    if (editing) {
      const { error } = await supabase.from('ticket_templates').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Template updated')
    } else {
      const { error } = await supabase.from('ticket_templates').insert({ ...payload, tenant_id: TENANT_ID, created_by: profile?.id })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Template created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('ticket_templates').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Template deleted')
    fetchAll()
  }

  async function duplicate(r: TicketTemplate) {
    const { error } = await supabase.from('ticket_templates').insert({
      tenant_id: TENANT_ID, name: `${r.name} (copy)`, subject: r.subject, description: r.description,
      priority: r.priority, ticket_type_id: r.ticket_type_id, company_id: r.company_id,
      is_active: true, created_by: profile?.id,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Template duplicated')
    fetchAll()
  }

  const priorityColor = (p: string) => p === 'critical' ? 'danger' : p === 'high' ? 'warning' : p === 'normal' ? 'info' : 'gray'

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Ticket Templates" count={rows.length} countLabel="template(s)"
        actions={isAdmin && <Button size="sm" onClick={openCreate}>New Template</Button>} />

      {rows.length === 0 ? (
        <EmptyState title="No templates yet" description="Create reusable templates to speed up ticket creation" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="text-violet-500 shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{r.name}</h3>
                </div>
                {!r.is_active && <Badge variant="gray">Inactive</Badge>}
              </div>
              {r.subject && <p className="text-sm text-gray-700 mb-1 truncate">{r.subject}</p>}
              <p className="text-xs text-gray-400 mb-3 line-clamp-2">{r.description || 'No description'}</p>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <Badge variant={priorityColor(r.priority)}>{r.priority}</Badge>
                {(r.ticket_type as any)?.name && <Badge variant="purple">{(r.ticket_type as any).name}</Badge>}
                {(r.company as any)?.name && <Badge variant="default">{(r.company as any).name}</Badge>}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 mt-auto pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-amber-600" title="Edit"><Pencil size={15} /></button>
                  <button onClick={() => duplicate(r)} className="p-1.5 text-gray-400 hover:text-violet-600" title="Duplicate"><Copy size={15} /></button>
                  <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Template' : 'New Template'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Password Reset, VPN Issue"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Pre-filled ticket subject"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Pre-filled ticket description / steps..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="low">Low</option><option value="normal">Normal</option>
                <option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Type</label>
              <select value={form.ticket_type_id} onChange={e => setForm(f => ({ ...f, ticket_type_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">None</option>
                {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Any</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
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
        title="Delete Template" message="Are you sure you want to delete this template?" />
    </div>
  )
}
