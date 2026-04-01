import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge, RoleBadge, ActiveBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile, Company } from '@operate1/types'

interface UserRow extends Profile {
  access: string[]
}

export function CompanyAccessPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: profiles }, { data: allCompanies }, { data: accessRows }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('companies').select('*').order('name'),
      supabase.from('user_company_access').select('profile_id, company_id'),
    ])
    const accessMap: Record<string, string[]> = {}
    for (const a of (accessRows || [])) {
      if (!accessMap[a.profile_id]) accessMap[a.profile_id] = []
      accessMap[a.profile_id].push(a.company_id)
    }
    setUsers((profiles || []).map(p => ({ ...p, access: accessMap[p.id] || [] })))
    setCompanies((allCompanies as Company[]) || [])
    setLoading(false)
  }

  function openEdit(u: UserRow) {
    setEditingUser(u)
    setSelected(new Set(u.access))
  }

  function toggleCompany(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!editingUser) return
    setSaving(true)
    // Delete existing access
    await supabase.from('user_company_access').delete().eq('profile_id', editingUser.id)
    // Insert new
    if (selected.size > 0) {
      const rows = Array.from(selected).map(company_id => ({
        profile_id: editingUser.id, company_id, tenant_id: TENANT_ID,
      }))
      const { error } = await supabase.from('user_company_access').insert(rows)
      if (error) { toast.error(error.message); setSaving(false); return }
    }
    toast.success('Company access updated')
    setSaving(false)
    setEditingUser(null)
    fetchAll()
  }

  const filtered = users.filter(u => !search || [u.full_name, u.username].some(f => f?.toLowerCase().includes(search.toLowerCase())))

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="User Company Access" count={filtered.length} countLabel="user(s)" />
      <p className="text-sm text-gray-500 mb-4">Manage which companies users can access</p>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <input placeholder="Search users by name or email..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Username</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Full Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Roles</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company Access</th>
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
                  <div className="flex flex-wrap gap-1">
                    {u.access.length === 0
                      ? <span className="text-gray-400 text-xs">0 companies</span>
                      : <Badge variant="info">{u.access.length} companie(s)</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(u)} className="p-1 text-gray-400 hover:text-cyan-600"><Pencil size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit Company Access — ${editingUser?.full_name}`}>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {companies.map(c => (
            <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleCompany(c.id)}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t mt-4">
          <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
