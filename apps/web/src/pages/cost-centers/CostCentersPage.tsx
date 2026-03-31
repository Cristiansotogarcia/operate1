import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CostCenter } from '@operate1/types'

export function CostCentersPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CostCenter | null>(null)
  const [form, setForm] = useState({ code: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase.from('cost_centers').select('*').order('code')
    if (error) toast.error(error.message)
    setRows((data as CostCenter[]) || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm({ code: '', description: '' }); setModalOpen(true) }
  function openEdit(r: CostCenter) { setEditing(r); setForm({ code: r.code, description: r.description || '' }); setModalOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { code: form.code, description: form.description || null }
    if (editing) {
      const { error } = await supabase.from('cost_centers').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Cost center updated')
    } else {
      const { error } = await supabase.from('cost_centers').insert({ ...payload, tenant_id: TENANT_ID })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Cost center created')
    }
    setSaving(false); setModalOpen(false); fetchData()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('cost_centers').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Cost center deleted'); fetchData()
  }

  const filtered = rows.filter(r => !search || [r.code, r.description].some(f => f?.toLowerCase().includes(search.toLowerCase())))

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Cost Centers Management" count={filtered.length} countLabel="cost center(s) found"
        actions={isAdmin && <Button size="sm" onClick={openCreate}>New Cost Center</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <input placeholder="Search by code or description..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
      </div>

      {filtered.length === 0 ? <EmptyState title="No cost centers found" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
              {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><Badge variant="success">{r.code}</Badge></td>
                  <td className="px-4 py-3">{r.description || r.code}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{r.id}</td>
                  {isAdmin && <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1 text-gray-400 hover:text-violet-600"><Eye size={15} /></button>
                      <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTarget(r.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Cost Center' : 'New Cost Center'} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
            <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Cost Center" message="Are you sure?" />
    </div>
  )
}
