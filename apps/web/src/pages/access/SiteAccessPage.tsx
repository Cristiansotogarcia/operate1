import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge, RoleBadge, ActiveBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile, Site } from '@operate1/types'

interface UserRow extends Profile {
  companyAccess: string[]
  siteAccess: string[]
}

export function SiteAccessPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [allSites, setAllSites] = useState<(Site & { company: { name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: profiles }, { data: sites }, { data: companyAccess }, { data: siteAccess }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('sites').select('*, company:companies(name)').order('name'),
      supabase.from('user_company_access').select('profile_id, company_id'),
      supabase.from('user_site_access').select('profile_id, site_id'),
    ])
    const caMap: Record<string, string[]> = {}
    for (const a of (companyAccess || [])) {
      if (!caMap[a.profile_id]) caMap[a.profile_id] = []
      caMap[a.profile_id].push(a.company_id)
    }
    const saMap: Record<string, string[]> = {}
    for (const a of (siteAccess || [])) {
      if (!saMap[a.profile_id]) saMap[a.profile_id] = []
      saMap[a.profile_id].push(a.site_id)
    }
    setUsers((profiles || []).map(p => ({ ...p, companyAccess: caMap[p.id] || [], siteAccess: saMap[p.id] || [] })))
    setAllSites((sites as any) || [])
    setLoading(false)
  }

  function openEdit(u: UserRow) {
    setEditingUser(u)
    setSelected(new Set(u.siteAccess))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!editingUser) return
    setSaving(true)
    await supabase.from('user_site_access').delete().eq('profile_id', editingUser.id)
    if (selected.size > 0) {
      const rows = Array.from(selected).map(site_id => ({ profile_id: editingUser.id, site_id, tenant_id: TENANT_ID }))
      const { error } = await supabase.from('user_site_access').insert(rows)
      if (error) { toast.error(error.message); setSaving(false); return }
    }
    toast.success('Site access updated')
    setSaving(false)
    setEditingUser(null)
    fetchAll()
  }

  // Sites available for editing user = only sites from their assigned companies
  const availableSites = editingUser
    ? allSites.filter(s => editingUser.companyAccess.includes(s.company_id))
    : []

  const filtered = users.filter(u => !search || [u.full_name, u.username].some(f => f?.toLowerCase().includes(search.toLowerCase())))

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="User Site Access" />
      <p className="text-sm text-gray-500 mb-4">Manage which sites users can access within their companies</p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex items-start gap-2">
        <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">Users must have company access before assigning sites. Sites can only be assigned from companies the user already has access to.</p>
      </div>

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
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Companies</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sites</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{u.username}</td>
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3"><ActiveBadge status={u.status} /></td>
                <td className="px-4 py-3"><Badge variant="info">{u.companyAccess.length} companie(s)</Badge></td>
                <td className="px-4 py-3"><Badge variant="purple">{u.siteAccess.length} site(s)</Badge></td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(u)} className="p-1 text-gray-400 hover:text-violet-600"><Pencil size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit Site Access — ${editingUser?.full_name}`}>
        {availableSites.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No sites available. Assign company access first.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {availableSites.map(s => (
              <label key={s.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)}
                  className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-sm">{s.name} <span className="text-gray-400">({(s.company as any)?.name})</span></span>
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-3 justify-end pt-4 border-t mt-4">
          <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
