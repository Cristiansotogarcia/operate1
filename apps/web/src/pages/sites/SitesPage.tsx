import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Company, CostCenter } from '@operate1/types'

interface SiteRow {
  id: string; name: string; company_id: string; cost_center_id: string | null; address: string | null
  company: { name: string } | null; cost_center: { code: string; description: string | null } | null
}

export function SitesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<SiteRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SiteRow | null>(null)
  const [form, setForm] = useState({ name: '', company_id: '', cost_center_id: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: s }, { data: co }, { data: cc }] = await Promise.all([
      supabase.from('sites').select('*, company:companies(name), cost_center:cost_centers(code, description)').order('name'),
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('cost_centers').select('*').order('code'),
    ])
    setRows((s as unknown as SiteRow[]) || [])
    setCompanies((co as Company[]) || [])
    setCostCenters((cc as CostCenter[]) || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm({ name: '', company_id: '', cost_center_id: '', address: '' }); setModalOpen(true) }
  function openEdit(r: SiteRow) { setEditing(r); setForm({ name: r.name, company_id: r.company_id, cost_center_id: r.cost_center_id || '', address: r.address || '' }); setModalOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name, company_id: form.company_id, cost_center_id: form.cost_center_id || null, address: form.address || null }
    if (editing) {
      const { error } = await supabase.from('sites').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Site updated')
    } else {
      const { error } = await supabase.from('sites').insert({ ...payload, tenant_id: TENANT_ID })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Site created')
    }
    setSaving(false); setModalOpen(false); fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('sites').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Site deleted'); fetchAll()
  }

  let filtered = rows
  if (search) filtered = filtered.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
  if (companyFilter) filtered = filtered.filter(r => r.company_id === companyFilter)

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Sites Management" count={filtered.length} countLabel="site(s) found"
        actions={isAdmin && <Button size="sm" onClick={openCreate}>New Site</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex gap-3">
          <input placeholder="Search site by name..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
          <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => { setSearch(''); setCompanyFilter('') }}
            className="text-sm text-gray-500 border border-gray-300 rounded-md px-3 py-2">Clear</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No sites found" description="Create your first site to get started" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cost Center</th>
              {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-cyan-600">{r.company?.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.cost_center ? `${r.cost_center.code} - ${r.cost_center.description || r.cost_center.code}` : '—'}</td>
                  {isAdmin && <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Site' : 'New Site'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
            <select required value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Select company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Cost Center</label>
            <select value={form.cost_center_id} onChange={e => setForm(f => ({ ...f, cost_center_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">None</option>{costCenters.map(c => <option key={c.id} value={c.id}>{c.code} - {c.description || c.code}</option>)}
            </select></div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Site" message="Are you sure?" />
    </div>
  )
}
