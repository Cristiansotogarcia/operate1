import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ContractStatusBadge, ContractTypeBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface CompanyRow {
  id: string
  name: string
  notes: string | null
  status: string
  contracts: { id: string; type: string; status: string }[]
  sites: { id: string }[]
}

export function CompaniesPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [rows, setRows] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompanyRow | null>(null)
  const [form, setForm] = useState({ name: '', notes: '', phone: '', email: '', website: '', address: '', contact_person: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, notes, status, contracts(id, type, status), sites(id)')
      .order('name')
    if (error) toast.error(error.message)
    setRows((data as unknown as CompanyRow[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', notes: '', phone: '', email: '', website: '', address: '', contact_person: '' })
    setModalOpen(true)
  }

  function openEdit(row: CompanyRow) {
    setEditing(row)
    setForm({ name: row.name, notes: row.notes || '', phone: '', email: '', website: '', address: '', contact_person: '' })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('companies').update({
        name: form.name, notes: form.notes || null,
        phone: form.phone || null, email: form.email || null, website: form.website || null,
        address: form.address || null, contact_person: form.contact_person || null,
      }).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Company updated')
    } else {
      const { error } = await supabase.from('companies').insert({
        tenant_id: TENANT_ID, name: form.name, notes: form.notes || null,
        phone: form.phone || null, email: form.email || null, website: form.website || null,
        address: form.address || null, contact_person: form.contact_person || null,
      })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Company created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchData()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('companies').delete().eq('id', deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Company deleted')
    fetchData()
  }

  const filtered = rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Companies Management"
        count={filtered.length}
        countLabel="compan(ies) found"
        actions={isAdmin && <Button size="sm" onClick={openCreate}>New Company</Button>}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <input
          placeholder="Search companies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No companies found" description="Create your first company to get started" />
      ) : (
        <>
          {/* Mobile card view */}
          <div className="space-y-3 lg:hidden">
            {filtered.map(row => {
              const activeContract = row.contracts?.find(c => c.status === 'active')
              return (
                <div
                  key={row.id}
                  onClick={() => navigate(`/companies/${row.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 active:bg-gray-50 cursor-pointer"
                >
                  <p className="text-sm font-semibold text-violet-600 mb-1">{row.name}</p>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                    {activeContract ? (
                      <>
                        <ContractTypeBadge type={activeContract.type as any} />
                        <ContractStatusBadge status={activeContract.status as any} />
                      </>
                    ) : (
                      <span>No active contract</span>
                    )}
                    <span>&middot; {row.sites?.length || 0} site(s)</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-1.5 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.id) }} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Active Contract</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contract Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contract Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sites</th>
                    {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(row => {
                    const activeContract = row.contracts?.find(c => c.status === 'active')
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-violet-600 cursor-pointer hover:underline" onClick={() => navigate(`/companies/${row.id}`)}>{row.name}</td>
                        <td className="px-4 py-3 text-gray-600">{activeContract ? 'Yes' : 'No active contract'}</td>
                        <td className="px-4 py-3">{activeContract ? <ContractTypeBadge type={activeContract.type as any} /> : '—'}</td>
                        <td className="px-4 py-3">{activeContract ? <ContractStatusBadge status={activeContract.status as any} /> : '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{row.sites?.length || 0} site(s)</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(row)} className="p-1 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                              <button onClick={() => setDeleteTarget(row.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Company' : 'New Company'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
                placeholder="Primary contact"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contact@company.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 234 567 890"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://company.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street, City, Country"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Company" message="This will also delete all associated sites. Are you sure?" loading={deleting} />
    </div>
  )
}
