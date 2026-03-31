import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2 } from 'lucide-react'
import type { TicketType } from '@operate1/types'
import toast from 'react-hot-toast'

export function TicketTypesPage() {
  const [types, setTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TicketType | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchTypes() }, [])

  async function fetchTypes() {
    setLoading(true)
    const { data, error } = await supabase.from('ticket_types').select('*').order('name')
    if (error) toast.error(error.message)
    setTypes(data || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setName('')
    setModalOpen(true)
  }

  function openEdit(t: TicketType) {
    setEditing(t)
    setName(t.name)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('ticket_types').update({ name: name.trim() }).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Updated')
    } else {
      const { error } = await supabase.from('ticket_types').insert({ tenant_id: TENANT_ID, name: name.trim() })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Created')
    }
    setSaving(false)
    setModalOpen(false)
    fetchTypes()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('ticket_types').delete().eq('id', deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Deleted')
    fetchTypes()
  }

  const filtered = types.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Ticket Types"
        count={filtered.length}
        countLabel="type(s) found"
        actions={<Button size="sm" onClick={openCreate}>New Type</Button>}
      />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <input
          placeholder="Search types..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No ticket types" description="Create types to categorise tickets" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(t)} className="p-1 text-gray-400 hover:text-amber-600 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(t.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Ticket Type' : 'New Ticket Type'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Hardware Issue"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Ticket Type"
        message="Deleting this type will not remove existing tickets but will unlink them. Continue?"
        loading={deleting}
      />
    </div>
  )
}
