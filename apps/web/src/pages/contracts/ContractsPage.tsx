import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ContractStatusBadge, ContractTypeBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Contract, Company } from '@operate1/types'

export function ContractsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<Contract[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [form, setForm] = useState({ contract_number: '', name: '', company_id: '', type: 'custom', status: 'draft', starts_at: '', ends_at: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: c }, { data: co }] = await Promise.all([
      supabase.from('contracts').select('*, company:companies(name)').order('contract_number'),
      supabase.from('companies').select('id, name').order('name'),
    ])
    setRows((c as Contract[]) || [])
    setCompanies((co as Company[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ contract_number: '', name: '', company_id: '', type: 'custom', status: 'draft', starts_at: '', ends_at: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(r: Contract) {
    setEditing(r)
    setForm({ contract_number: r.contract_number, name: r.name, company_id: r.company_id || '', type: r.type, status: r.status, starts_at: r.starts_at || '', ends_at: r.ends_at || '', notes: r.notes || '' })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      contract_number: form.contract_number,
      name: form.name,
      company_id: form.company_id || null,
      type: form.type,
      status: form.status,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('contracts').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Contract updated')
    } else {
      const { error } = await supabase.from('contracts').insert({ ...payload, tenant_id: TENANT_ID })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Contract created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchAll()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('contracts').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Contract deleted')
    fetchAll()
  }

  let filtered = rows
  if (search) filtered = filtered.filter(r => [r.contract_number, r.name].some(f => f?.toLowerCase().includes(search.toLowerCase())))
  if (typeFilter) filtered = filtered.filter(r => r.type === typeFilter)
  if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter)

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Contracts Management" count={filtered.length} countLabel="contract(s) found"
        actions={isAdmin && <Button size="sm" onClick={openCreate}>New Contract</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Contract number, name..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Types</option><option value="custom">Custom</option><option value="standard">Standard</option><option value="hourly">Hourly</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option>
          </select>
          <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-2">Clear Filters</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No contracts found" /> : (
        <>
          {/* Mobile card view */}
          <div className="space-y-3 lg:hidden">
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-cyan-600">{r.contract_number}</p>
                    <p className="text-sm text-gray-900 truncate">{r.name}</p>
                  </div>
                  <ContractStatusBadge status={r.status} />
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>{(r.company as any)?.name || 'No company'}</p>
                  <div className="flex items-center justify-between">
                    <ContractTypeBadge type={r.type} />
                    <span>{formatDate(r.starts_at)} — {formatDate(r.ends_at)}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contract #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-cyan-600">{r.contract_number}</td>
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3">{(r.company as any)?.name || 'N/A'}</td>
                      <td className="px-4 py-3"><ContractTypeBadge type={r.type} /></td>
                      <td className="px-4 py-3"><ContractStatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.starts_at)}<br />{formatDate(r.ends_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1 text-gray-400 hover:text-cyan-600"><Eye size={15} /></button>
                          {isAdmin && <>
                            <button onClick={() => openEdit(r)} className="p-1 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                            <button onClick={() => setDeleteTarget(r.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Contract' : 'New Contract'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contract # *</label>
              <input required value={form.contract_number} onChange={e => setForm(f => ({ ...f, contract_number: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="custom">Custom</option><option value="standard">Standard</option><option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="draft">Draft</option><option value="active">Active</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Contract" message="Are you sure you want to delete this contract?" />
    </div>
  )
}
