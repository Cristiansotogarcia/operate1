import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2, Shield, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CustomRole, RolePermission } from '@operate1/types'

const MODULES = [
  { key: 'tickets', label: 'Tickets' },
  { key: 'companies', label: 'Companies' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'sites', label: 'Sites' },
  { key: 'devices', label: 'Devices' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'knowledge', label: 'Knowledge Base' },
  { key: 'reporting', label: 'Reporting' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'api_keys', label: 'API Keys' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'users', label: 'User Management' },
  { key: 'sla', label: 'SLA Policies' },
]

const ACTIONS = ['can_view', 'can_create', 'can_edit', 'can_delete'] as const

interface PermMap { [module: string]: { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean } }

function buildPermMap(perms: RolePermission[]): PermMap {
  const map: PermMap = {}
  MODULES.forEach(m => { map[m.key] = { can_view: false, can_create: false, can_edit: false, can_delete: false } })
  perms.forEach(p => { if (map[p.module]) map[p.module] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete } })
  return map
}

export function RolesPage() {
  const [roles, setRoles] = useState<(CustomRole & { permissions: RolePermission[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomRole | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [permMap, setPermMap] = useState<PermMap>(buildPermMap([]))
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => { fetchRoles() }, [])

  async function fetchRoles() {
    setLoading(true)
    const { data } = await supabase.from('custom_roles').select('*, permissions:role_permissions(*)').order('name')
    setRoles((data as any[]) || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setPermMap(buildPermMap([]))
    setModalOpen(true)
  }

  function openEdit(r: CustomRole & { permissions: RolePermission[] }) {
    setEditing(r)
    setForm({ name: r.name, description: r.description || '' })
    setPermMap(buildPermMap(r.permissions))
    setModalOpen(true)
  }

  function togglePerm(module: string, action: typeof ACTIONS[number]) {
    setPermMap(prev => ({
      ...prev,
      [module]: { ...prev[module], [action]: !prev[module][action] },
    }))
  }

  function toggleAll(action: typeof ACTIONS[number]) {
    const allOn = MODULES.every(m => permMap[m.key][action])
    setPermMap(prev => {
      const next = { ...prev }
      MODULES.forEach(m => { next[m.key] = { ...next[m.key], [action]: !allOn } })
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let roleId = editing?.id

    if (editing) {
      const { error } = await supabase.from('custom_roles').update({ name: form.name, description: form.description || null }).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('custom_roles').insert({ tenant_id: TENANT_ID, name: form.name, description: form.description || null }).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      roleId = data.id
    }

    // Upsert permissions
    if (roleId) {
      await supabase.from('role_permissions').delete().eq('role_id', roleId)
      const permsToInsert = MODULES.map(m => ({
        role_id: roleId!, module: m.key, ...permMap[m.key],
      }))
      const { error } = await supabase.from('role_permissions').insert(permsToInsert)
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    setSaving(false)
    setModalOpen(false)
    toast.success(editing ? 'Role updated' : 'Role created')
    fetchRoles()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('custom_roles').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Role deleted')
    fetchRoles()
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Roles & Permissions" count={roles.length} countLabel="role(s)"
        actions={<Button size="sm" onClick={openCreate}>New Role</Button>} />

      {roles.length === 0 ? <EmptyState title="No roles defined" /> : (
        <div className="space-y-4">
          {roles.map(r => {
            const perms = r.permissions || []
            const viewCount = perms.filter(p => p.can_view).length
            const editCount = perms.filter(p => p.can_edit).length
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <Shield size={20} className="text-cyan-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{r.name}</h3>
                      <p className="text-xs text-gray-400">{r.description || 'No description'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_system && <Badge variant="purple">System</Badge>}
                    <button onClick={() => openEdit(r)} className="p-1.5 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                    {!r.is_system && (
                      <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>Can view: <strong>{viewCount}</strong> modules</span>
                  <span>Can edit: <strong>{editCount}</strong> modules</span>
                  <span>Total permissions: <strong>{perms.length}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Role' : 'New Role'} size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={editing?.is_system}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Module Permissions</p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Module</th>
                    {ACTIONS.map(a => (
                      <th key={a} className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:text-cyan-600"
                        onClick={() => toggleAll(a)}>
                        {a.replace('can_', '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MODULES.map(m => (
                    <tr key={m.key} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{m.label}</td>
                      {ACTIONS.map(a => (
                        <td key={a} className="text-center px-3 py-2">
                          <button type="button" onClick={() => togglePerm(m.key, a)}
                            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                              permMap[m.key][a] ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                            }`}>
                            {permMap[m.key][a] ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Role" message="Are you sure? Users assigned to this role will lose their custom permissions." />
    </div>
  )
}
