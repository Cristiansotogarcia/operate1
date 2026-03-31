import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { RoleBadge, ActiveBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Ban, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile } from '@operate1/types'

export function UserManagementPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', username: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) toast.error(error.message)
    setUsers((data as Profile[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ email: '', password: '', full_name: '', username: '', role: 'user' })
    setModalOpen(true)
  }

  function openEdit(u: Profile) {
    setEditing(u)
    setForm({ email: '', password: '', full_name: u.full_name || '', username: u.username || '', role: u.role })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (editing) {
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name, username: form.username, role: form.role,
      }).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('User updated')
    } else {
      // Creating a new user requires the Supabase Auth Admin API
      // This would normally be done via an Edge Function or Electron IPC with service role key.
      // For MVP, we sign up normally (user will need to confirm email if enabled).
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name, username: form.username || form.email.split('@')[0], role: form.role },
        },
      })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('User created. They may need to confirm their email.')
    }
    setSaving(false)
    setModalOpen(false)
    fetchUsers()
  }

  async function toggleStatus(u: Profile) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', u.id)
    if (error) { toast.error(error.message); return }
    toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    fetchUsers()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    // Note: deleting the profile row. auth.users row won't be deleted without admin API.
    const { error } = await supabase.from('profiles').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('User removed')
    fetchUsers()
  }

  const filtered = users.filter(u => !search || [u.full_name, u.username].some(f => f?.toLowerCase().includes(search.toLowerCase())))

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="User Management" count={filtered.length} countLabel="user(s)"
        actions={<Button size="sm" onClick={openCreate}>+ Create User</Button>} />
      <p className="text-sm text-gray-500 mb-4">Create, edit, and manage system users</p>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <input placeholder="Search users by name or email..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Username</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Full Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Roles</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3"><ActiveBadge status={u.status} /></td>
                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(u)} className="p-1 text-gray-400 hover:text-amber-600" title="Edit"><Pencil size={15} /></button>
                    <button onClick={() => toggleStatus(u)} className="p-1 text-gray-400 hover:text-orange-600" title={u.status === 'active' ? 'Deactivate' : 'Activate'}><Ban size={15} /></button>
                    <button onClick={() => setDeleteTarget(u.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSave} className="space-y-4">
          {!editing && (
            <>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input required type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
            </>
          )}
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="user">User</option><option value="admin">Admin</option>
            </select></div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete User" message="Are you sure you want to remove this user?" />
    </div>
  )
}
