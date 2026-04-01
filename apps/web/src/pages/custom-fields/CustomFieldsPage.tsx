import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2, GripVertical, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CustomFieldDefinition, CustomFieldType } from '@operate1/types'

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
]

export function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', label: '', field_type: 'text' as CustomFieldType,
    is_required: false, is_active: true, options: [] as string[],
  })
  const [newOption, setNewOption] = useState('')

  useEffect(() => { fetchFields() }, [])

  async function fetchFields() {
    setLoading(true)
    const { data } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('entity_type', 'ticket')
      .order('sort_order')
    setFields((data as CustomFieldDefinition[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', label: '', field_type: 'text', is_required: false, is_active: true, options: [] })
    setNewOption('')
    setModalOpen(true)
  }

  function openEdit(f: CustomFieldDefinition) {
    setEditing(f)
    setForm({
      name: f.name, label: f.label, field_type: f.field_type,
      is_required: f.is_required, is_active: f.is_active,
      options: (f.options as string[]) || [],
    })
    setNewOption('')
    setModalOpen(true)
  }

  function addOption() {
    if (!newOption.trim()) return
    setForm(f => ({ ...f, options: [...f.options, newOption.trim()] }))
    setNewOption('')
  }

  function removeOption(idx: number) {
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.label.trim()) { toast.error('Name and label required'); return }
    setSaving(true)
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')
    const payload = {
      name: slug,
      label: form.label,
      field_type: form.field_type,
      is_required: form.is_required,
      is_active: form.is_active,
      options: form.field_type === 'select' ? form.options : [],
    }
    if (editing) {
      const { error } = await supabase.from('custom_field_definitions').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Field updated')
    } else {
      const { error } = await supabase.from('custom_field_definitions').insert({
        ...payload, tenant_id: TENANT_ID, entity_type: 'ticket', sort_order: fields.length,
      })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Field created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchFields()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('custom_field_definitions').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Field deleted')
    fetchFields()
  }

  const typeLabel = (t: string) => FIELD_TYPES.find(f => f.value === t)?.label ?? t

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Custom Fields" subtitle="Define additional fields for tickets"
        count={fields.length} countLabel="field(s)"
        actions={<Button size="sm" onClick={openCreate}>New Field</Button>} />

      {fields.length === 0 ? <EmptyState title="No custom fields" description="Add custom fields that appear on every ticket" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50">
                <GripVertical size={16} className="text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{f.label}</p>
                    <Badge variant="purple">{typeLabel(f.field_type)}</Badge>
                    {f.is_required && <Badge variant="warning">Required</Badge>}
                    {!f.is_active && <Badge variant="gray">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{f.name}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteTarget(f.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Field' : 'New Custom Field'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
              <input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value, name: editing ? f.name : e.target.value }))}
                placeholder="e.g. Asset Tag"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Type *</label>
              <select value={form.field_type} onChange={e => setForm(f => ({ ...f, field_type: e.target.value as CustomFieldType }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {form.field_type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dropdown Options</label>
              <div className="flex gap-2 mb-2">
                <input value={newOption} onChange={e => setNewOption(e.target.value)}
                  placeholder="Add option..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
                <Button type="button" size="sm" variant="outline" onClick={addOption}><Plus size={14} /></Button>
              </div>
              <div className="space-y-1">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-sm">
                    <span>{opt}</span>
                    <button type="button" onClick={() => removeOption(i)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))}
                className="rounded border-gray-300 text-violet-600" />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-violet-600" />
              Active
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Field" message="This will remove the field and all saved values. Are you sure?" />
    </div>
  )
}
