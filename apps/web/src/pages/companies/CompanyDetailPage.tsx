import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { ContractStatusBadge, ContractTypeBadge } from '@/components/ui/Badge'
import {
  ArrowLeft, Building2, MapPin, FileText, Phone, Mail, Globe,
  User, Pencil, Trash2, Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { CostCenter } from '@operate1/types'

interface CompanyDetail {
  id: string; name: string; notes: string | null; status: string
  phone: string | null; email: string | null; website: string | null
  address: string | null; contact_person: string | null
  created_at: string
}

interface SiteRow {
  id: string; name: string; address: string | null; company_id: string
  cost_center_id: string | null
  cost_center: { code: string; description: string | null } | null
}

interface ContractRow {
  id: string; contract_number: string; type: string; status: string
  start_date: string | null; end_date: string | null; notes: string | null
}

type Tab = 'overview' | 'sites' | 'contracts'

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [sites, setSites] = useState<SiteRow[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenter[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  // Company edit
  const [editModal, setEditModal] = useState(false)
  const [companyForm, setCompanyForm] = useState({
    name: '', notes: '', phone: '', email: '', website: '', address: '', contact_person: '', status: 'active',
  })
  const [savingCompany, setSavingCompany] = useState(false)

  // Site modal
  const [siteModal, setSiteModal] = useState(false)
  const [editingSite, setEditingSite] = useState<SiteRow | null>(null)
  const [siteForm, setSiteForm] = useState({ name: '', address: '', cost_center_id: '' })
  const [savingSite, setSavingSite] = useState(false)
  const [deleteSiteId, setDeleteSiteId] = useState<string | null>(null)

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [{ data: co }, { data: si }, { data: ct }, { data: cc }] = await Promise.all([
      supabase.from('companies').select('*').eq('id', id!).single(),
      supabase.from('sites').select('*, cost_center:cost_centers(code, description)').eq('company_id', id!).order('name'),
      supabase.from('contracts').select('*').eq('company_id', id!).order('start_date', { ascending: false }),
      supabase.from('cost_centers').select('*').order('code'),
    ])
    setCompany(co as CompanyDetail | null)
    setSites((si as unknown as SiteRow[]) ?? [])
    setContracts((ct as ContractRow[]) ?? [])
    setCostCenters((cc as CostCenter[]) ?? [])
    setLoading(false)
  }

  // ─── Company Edit ─────────────────────────────
  function openEditCompany() {
    if (!company) return
    setCompanyForm({
      name: company.name,
      notes: company.notes ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      website: company.website ?? '',
      address: company.address ?? '',
      contact_person: company.contact_person ?? '',
      status: company.status,
    })
    setEditModal(true)
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!companyForm.name.trim()) { toast.error('Company name is required'); return }
    setSavingCompany(true)
    const { error } = await supabase.from('companies').update({
      name: companyForm.name.trim(),
      notes: companyForm.notes.trim() || null,
      phone: companyForm.phone.trim() || null,
      email: companyForm.email.trim() || null,
      website: companyForm.website.trim() || null,
      address: companyForm.address.trim() || null,
      contact_person: companyForm.contact_person.trim() || null,
      status: companyForm.status,
    }).eq('id', id!)
    setSavingCompany(false)
    if (error) { toast.error(error.message); return }
    toast.success('Company updated')
    setEditModal(false)
    fetchAll()
  }

  // ─── Sites ────────────────────────────────────
  function openCreateSite() {
    setEditingSite(null)
    setSiteForm({ name: '', address: '', cost_center_id: '' })
    setSiteModal(true)
  }

  function openEditSite(s: SiteRow) {
    setEditingSite(s)
    setSiteForm({ name: s.name, address: s.address ?? '', cost_center_id: s.cost_center_id ?? '' })
    setSiteModal(true)
  }

  async function saveSite(e: React.FormEvent) {
    e.preventDefault()
    if (!siteForm.name.trim()) { toast.error('Site name is required'); return }
    setSavingSite(true)
    const payload = {
      name: siteForm.name.trim(),
      address: siteForm.address.trim() || null,
      cost_center_id: siteForm.cost_center_id || null,
    }
    if (editingSite) {
      const { error } = await supabase.from('sites').update(payload).eq('id', editingSite.id)
      if (error) { toast.error(error.message); setSavingSite(false); return }
      toast.success('Site updated')
    } else {
      const { error } = await supabase.from('sites').insert({ ...payload, tenant_id: TENANT_ID, company_id: id! })
      if (error) { toast.error(error.message); setSavingSite(false); return }
      toast.success('Site created')
    }
    setSavingSite(false)
    setSiteModal(false)
    fetchAll()
  }

  async function confirmDeleteSite() {
    if (!deleteSiteId) return
    const { error } = await supabase.from('sites').delete().eq('id', deleteSiteId)
    setDeleteSiteId(null)
    if (error) { toast.error(error.message); return }
    toast.success('Site deleted')
    fetchAll()
  }

  if (loading) return <PageLoader />
  if (!company) return <div className="p-6 text-center text-gray-500">Company not found.</div>

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'overview', label: 'Overview', count: 0 },
    { key: 'sites', label: 'Sites', count: sites.length },
    { key: 'contracts', label: 'Contracts', count: contracts.length },
  ]

  return (
    <div className="p-6">
      {/* Back + header */}
      <button onClick={() => navigate('/companies')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Companies
      </button>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center">
            <Building2 size={24} className="text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={company.status === 'active' ? 'success' : 'gray'}>{company.status}</Badge>
              {company.contact_person && <span className="text-sm text-gray-500">{company.contact_person}</span>}
            </div>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" variant="secondary" onClick={openEditCompany}>
            <Pencil size={14} className="mr-1" /> Edit Company
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-b-2 border-cyan-600 text-cyan-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}{t.count > 0 && <span className="ml-1 text-xs text-gray-400">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Contact Information</h3>
            <div className="space-y-3">
              <InfoRow icon={<User size={15} />} label="Contact Person" value={company.contact_person} />
              <InfoRow icon={<Mail size={15} />} label="Email" value={company.email} />
              <InfoRow icon={<Phone size={15} />} label="Phone" value={company.phone} />
              <InfoRow icon={<Globe size={15} />} label="Website" value={company.website} />
              <InfoRow icon={<MapPin size={15} />} label="Address" value={company.address} />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{company.notes || <span className="text-gray-300">No notes</span>}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Sites</p>
                <p className="text-sm text-gray-700">{sites.length} site(s)</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Active Contracts</p>
                <p className="text-sm text-gray-700">{contracts.filter(c => c.status === 'active').length}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Created</p>
                <p className="text-sm text-gray-700">{new Date(company.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sites tab */}
      {tab === 'sites' && (
        <div>
          {isAdmin && (
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={openCreateSite}><Plus size={14} className="mr-1" />Add Site</Button>
            </div>
          )}
          {sites.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No sites yet.</p>
              {isAdmin && <Button size="sm" className="mt-3" onClick={openCreateSite}>Add First Site</Button>}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Site Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Address</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cost Center</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {sites.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.address || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {s.cost_center ? `${s.cost_center.code} — ${s.cost_center.description || s.cost_center.code}` : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => openEditSite(s)} className="text-gray-400 hover:text-amber-600"><Pencil size={14} /></button>
                            <button onClick={() => setDeleteSiteId(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contracts tab */}
      {tab === 'contracts' && (
        <div>
          {contracts.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No contracts for this company.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contract #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">End</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {contracts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium font-mono text-cyan-600">{c.contract_number}</td>
                      <td className="px-4 py-3"><ContractTypeBadge type={c.type as any} /></td>
                      <td className="px-4 py-3"><ContractStatusBadge status={c.status as any} /></td>
                      <td className="px-4 py-3 text-gray-600">{c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Company edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Company" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
          <Button onClick={saveCompany} loading={savingCompany}>Save Changes</Button>
        </>}
      >
        <form onSubmit={saveCompany} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input required value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={companyForm.status} onChange={e => setCompanyForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input value={companyForm.contact_person} onChange={e => setCompanyForm(f => ({ ...f, contact_person: e.target.value }))}
                placeholder="Primary contact"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={companyForm.email} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))}
                placeholder="contact@company.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={companyForm.phone} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 234 567 890"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input value={companyForm.website} onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://company.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street, City, Country"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={companyForm.notes} onChange={e => setCompanyForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        </form>
      </Modal>

      {/* Site modal */}
      <Modal open={siteModal} onClose={() => setSiteModal(false)} title={editingSite ? 'Edit Site' : 'Add Site'} size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setSiteModal(false)}>Cancel</Button>
          <Button onClick={saveSite} loading={savingSite}>{editingSite ? 'Save' : 'Create Site'}</Button>
        </>}
      >
        <form onSubmit={saveSite} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Name *</label>
            <input required value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Office, Warehouse A"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input value={siteForm.address} onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street, City, Country"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Center</label>
            <select value={siteForm.cost_center_id} onChange={e => setSiteForm(f => ({ ...f, cost_center_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="">None</option>
              {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {c.description || c.code}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteSiteId} onClose={() => setDeleteSiteId(null)} onConfirm={confirmDeleteSite}
        title="Delete Site" message="Are you sure you want to delete this site?" />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-700">{value || <span className="text-gray-300">Not set</span>}</p>
      </div>
    </div>
  )
}
