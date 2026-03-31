import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Badge, DeviceStatusBadge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PageLoader } from '@/components/ui/Spinner'
import { timeAgo, formatDateTime } from '@/lib/utils'
import { Monitor, Copy, Check, Edit2, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Device, Company, Site, Profile } from '@operate1/types'

const DEVICE_TYPES = ['workstation', 'laptop', 'server', 'network', 'printer', 'mobile', 'other'] as const

interface ExtendedDevice extends Device {
  asset_tag?: string | null
  serial_number?: string | null
  model?: string | null
  manufacturer?: string | null
  device_type?: string
  assigned_user_id?: string | null
  warranty_expires_at?: string | null
  purchased_at?: string | null
  notes?: string | null
  assigned_user?: Pick<Profile, 'id' | 'full_name' | 'username'> | null
}

interface AssetForm {
  asset_tag: string
  serial_number: string
  model: string
  manufacturer: string
  device_type: string
  assigned_user_id: string
  warranty_expires_at: string
  purchased_at: string
  notes: string
}

const EMPTY_ASSET: AssetForm = {
  asset_tag: '', serial_number: '', model: '', manufacturer: '',
  device_type: 'workstation', assigned_user_id: '', warranty_expires_at: '', purchased_at: '', notes: '',
}

export function DevicesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [devices, setDevices] = useState<ExtendedDevice[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [filteredSites, setFilteredSites] = useState<Site[]>([])
  const [adminUsers, setAdminUsers] = useState<Pick<Profile, 'id' | 'full_name' | 'username'>[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [pairingCodeModal, setPairingCodeModal] = useState<{ name: string; code: string; expires: string } | null>(null)
  const [assetModal, setAssetModal] = useState<ExtendedDevice | null>(null)
  const [form, setForm] = useState({ name: '', company_id: '', site_id: '', expiry: '24' })
  const [assetForm, setAssetForm] = useState<AssetForm>(EMPTY_ASSET)
  const [saving, setSaving] = useState(false)
  const [savingAsset, setSavingAsset] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const channel = supabase.channel('devices-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => { fetchDevices() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: d }, { data: c }, { data: s }, { data: u }] = await Promise.all([
      supabase.from('devices').select('*, company:companies(name), site:sites(name), assigned_user:profiles!devices_assigned_user_id_fkey(id,full_name,username)').order('name'),
      supabase.from('companies').select('id, name').order('name'),
      supabase.from('sites').select('id, name, company_id').order('name'),
      supabase.from('profiles').select('id,full_name,username').eq('role', 'admin').eq('status', 'active'),
    ])
    setDevices((d as ExtendedDevice[]) || [])
    setCompanies((c as Company[]) || [])
    setSites((s as Site[]) || [])
    setAdminUsers(u || [])
    setLoading(false)
  }

  async function fetchDevices() {
    const { data } = await supabase.from('devices').select('*, company:companies(name), assigned_user:profiles!devices_assigned_user_id_fkey(id,full_name,username)').order('name')
    setDevices((data as ExtendedDevice[]) || [])
  }

  function generatePairingCode(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const array = new Uint8Array(6)
    crypto.getRandomValues(array)
    return Array.from(array, b => chars[b % chars.length]).join('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // 1. Create device
    const { data: device, error: devErr } = await supabase.from('devices').insert({
      tenant_id: TENANT_ID,
      name: form.name,
      company_id: form.company_id || null,
      site_id: form.site_id || null,
    }).select('id, name').single()

    if (devErr || !device) { toast.error(devErr?.message || 'Failed to create device'); setSaving(false); return }

    // 2. Generate pairing code
    const code = generatePairingCode()
    const expiryHours = parseInt(form.expiry) || 24
    const expiresAt = new Date(Date.now() + expiryHours * 3600000).toISOString()

    const { error: codeErr } = await supabase.from('pairing_codes').insert({
      tenant_id: TENANT_ID,
      code,
      device_id: device.id,
      company_id: form.company_id || null,
      site_id: form.site_id || null,
      created_by: profile?.id,
      expires_at: expiresAt,
    })

    setSaving(false)
    if (codeErr) { toast.error(codeErr.message); return }

    setModalOpen(false)
    setPairingCodeModal({ name: device.name, code, expires: `${expiryHours} hours` })
    fetchDevices()
  }

  function openAssetModal(device: ExtendedDevice) {
    setAssetModal(device)
    setAssetForm({
      asset_tag: device.asset_tag ?? '',
      serial_number: device.serial_number ?? '',
      model: device.model ?? '',
      manufacturer: device.manufacturer ?? '',
      device_type: device.device_type ?? 'workstation',
      assigned_user_id: device.assigned_user_id ?? '',
      warranty_expires_at: device.warranty_expires_at?.slice(0, 10) ?? '',
      purchased_at: device.purchased_at?.slice(0, 10) ?? '',
      notes: device.notes ?? '',
    })
  }

  async function saveAsset() {
    if (!assetModal) return
    setSavingAsset(true)
    const { error } = await supabase.from('devices').update({
      asset_tag: assetForm.asset_tag || null,
      serial_number: assetForm.serial_number || null,
      model: assetForm.model || null,
      manufacturer: assetForm.manufacturer || null,
      device_type: assetForm.device_type,
      assigned_user_id: assetForm.assigned_user_id || null,
      warranty_expires_at: assetForm.warranty_expires_at || null,
      purchased_at: assetForm.purchased_at || null,
      notes: assetForm.notes || null,
    }).eq('id', assetModal.id)
    setSavingAsset(false)
    if (error) { toast.error(error.message); return }
    toast.success('Asset details saved')
    setAssetModal(null)
    fetchDevices()
  }

  function handleCopyCode() {
    if (!pairingCodeModal) return
    navigator.clipboard.writeText(pairingCodeModal.code)
    setCopied(true)
    toast.success('Pairing code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('devices').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Device deleted')
    fetchDevices()
  }

  async function regenerateCode(device: ExtendedDevice) {
    const code = generatePairingCode()
    const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString()

    // Invalidate old codes for this device
    await supabase.from('pairing_codes').delete().eq('device_id', device.id).is('claimed_at', null)

    const { error } = await supabase.from('pairing_codes').insert({
      tenant_id: TENANT_ID,
      code,
      device_id: device.id,
      company_id: device.company_id || null,
      site_id: (device as any).site_id || null,
      created_by: profile?.id,
      expires_at: expiresAt,
    })

    if (error) { toast.error(error.message); return }
    setPairingCodeModal({ name: device.name, code, expires: '24 hours' })
  }

  function warrantyStatus(date: string | null | undefined): 'success' | 'warning' | 'danger' | null {
    if (!date) return null
    const daysLeft = (new Date(date).getTime() - Date.now()) / 86400000
    if (daysLeft < 0) return 'danger'
    if (daysLeft < 30) return 'warning'
    return 'success'
  }

  const af = (field: keyof AssetForm, val: string) => setAssetForm(f => ({ ...f, [field]: val }))

  let filtered = devices
  if (search) filtered = filtered.filter(d => [d.name, d.computer_name, d.serial_number, d.asset_tag].some(f => f?.toLowerCase().includes(search.toLowerCase())))
  if (statusFilter) filtered = filtered.filter(d => d.status === statusFilter)
  if (typeFilter) filtered = filtered.filter(d => (d.device_type ?? 'workstation') === typeFilter)

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Devices Management" count={filtered.length} countLabel="device(s) found"
        actions={isAdmin && <Button size="sm" onClick={() => { setForm({ name: '', company_id: '', site_id: '', expiry: '24' }); setFilteredSites([]); setModalOpen(true) }}>New Device</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Search & Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Name, serial, asset tag..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option><option value="online">Online</option><option value="offline">Offline</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Types</option>
            {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <button onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter('') }}
            className="text-sm text-gray-500 border border-gray-300 rounded-md px-3 py-2">Clear Filters</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No devices found" description="Register your first device to get started" /> : (
        <div className="space-y-4">
          {filtered.map(d => {
            const isExpanded = expandedId === d.id
            const ws = d.warranty_expires_at ? warrantyStatus(d.warranty_expires_at) : null

            return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <Monitor size={20} className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{d.name}</h3>
                        <p className="text-xs text-violet-500 font-mono">{d.computer_name || 'Pending registration'}</p>
                        {d.device_type && d.device_type !== 'workstation' && (
                          <p className="text-xs text-gray-400 capitalize">{d.device_type}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <button onClick={() => regenerateCode(d)} className="text-gray-400 hover:text-violet-600" title="Generate pairing code">
                            <RefreshCw size={15} />
                          </button>
                          <button onClick={() => openAssetModal(d)} className="text-gray-400 hover:text-violet-600" title="Edit asset details">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(d.id)} className="text-gray-400 hover:text-red-500" title="Delete device">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                      <DeviceStatusBadge status={d.status} />
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <ProgressBar value={d.cpu_percent ?? 0} label="CPU" />
                    <ProgressBar value={d.ram_percent ?? 0} label="RAM" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <span>{d.last_ip || '—'}</span>
                    <div className="flex items-center gap-3">
                      <span>{d.last_seen_at ? timeAgo(d.last_seen_at) : 'Never seen'}</span>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : d.id)}
                        className="flex items-center gap-1 text-violet-600 hover:text-violet-700 font-medium"
                      >
                        {isExpanded ? <><ChevronUp size={13} />Less</> : <><ChevronDown size={13} />Asset details</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Asset details panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Asset Tag</p>
                        <p className="text-gray-700">{d.asset_tag || <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Serial Number</p>
                        <p className="text-gray-700 font-mono text-xs">{d.serial_number || <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Model</p>
                        <p className="text-gray-700">{d.model ? `${d.manufacturer ?? ''} ${d.model}`.trim() : <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Assigned To</p>
                        <p className="text-gray-700">{d.assigned_user ? (d.assigned_user.full_name || d.assigned_user.username) : <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">OS</p>
                        <p className="text-gray-700">{d.os || <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Purchased</p>
                        <p className="text-gray-700">{d.purchased_at ? new Date(d.purchased_at).toLocaleDateString() : <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Warranty Expires</p>
                        {d.warranty_expires_at ? (
                          <div className="flex items-center gap-1">
                            <p className="text-gray-700">{new Date(d.warranty_expires_at).toLocaleDateString()}</p>
                            {ws && <Badge variant={ws} className="text-[10px]">{ws === 'danger' ? 'Expired' : ws === 'warning' ? '< 30 days' : 'Valid'}</Badge>}
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Company</p>
                        <p className="text-gray-700">{(d.company as any)?.name || <span className="text-gray-300">—</span>}</p>
                      </div>
                      {d.notes && (
                        <div className="col-span-4">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-0.5">Notes</p>
                          <p className="text-gray-700 text-xs">{d.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Device Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Device" size="md"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" form="create-device-form" loading={saving}>Create & Generate Code</Button></>}>
        <form id="create-device-form" onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Device Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Reception-PC, Server-01"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select value={form.company_id} onChange={e => { setForm(f => ({ ...f, company_id: e.target.value, site_id: '' })); setFilteredSites(sites.filter(s => s.company_id === e.target.value)) }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
              <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} disabled={!form.company_id}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white disabled:bg-gray-50">
                <option value="">{form.company_id ? 'Select site' : 'Select company first'}</option>
                {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Code Expiry</label>
            <select value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="1">1 hour</option>
              <option value="24">24 hours</option>
              <option value="168">7 days</option>
            </select></div>
        </form>
      </Modal>

      {/* Asset Details Modal */}
      <Modal
        open={!!assetModal}
        onClose={() => setAssetModal(null)}
        title={`Asset Details — ${assetModal?.name}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssetModal(null)}>Cancel</Button>
            <Button onClick={saveAsset} loading={savingAsset}>Save Changes</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Asset Tag</label>
            <input value={assetForm.asset_tag} onChange={e => af('asset_tag', e.target.value)} placeholder="e.g. IT-0042"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
            <input value={assetForm.serial_number} onChange={e => af('serial_number', e.target.value)} placeholder="e.g. SN-ABC123"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <input value={assetForm.manufacturer} onChange={e => af('manufacturer', e.target.value)} placeholder="e.g. Dell"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <input value={assetForm.model} onChange={e => af('model', e.target.value)} placeholder="e.g. OptiPlex 7090"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
            <select value={assetForm.device_type} onChange={e => af('device_type', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              {DEVICE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
            <select value={assetForm.assigned_user_id} onChange={e => af('assigned_user_id', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">Unassigned</option>
              {adminUsers.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
            </select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
            <input type="date" value={assetForm.purchased_at} onChange={e => af('purchased_at', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Warranty Expires</label>
            <input type="date" value={assetForm.warranty_expires_at} onChange={e => af('warranty_expires_at', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={assetForm.notes} onChange={e => af('notes', e.target.value)} rows={3} placeholder="Any additional notes..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none" /></div>
        </div>
      </Modal>

      {/* Pairing Code Modal */}
      <Modal open={!!pairingCodeModal} onClose={() => setPairingCodeModal(null)} title="Pairing Code" size="sm">
        <div className="space-y-4 text-center">
          <p className="text-sm text-gray-600">
            Device <strong>{pairingCodeModal?.name}</strong> created. Enter this code in the Operate1 agent on the target machine.
          </p>
          <div className="bg-violet-50 border-2 border-violet-200 rounded-xl py-5 px-4">
            <p className="text-4xl font-bold font-mono tracking-[12px] text-violet-700">
              {pairingCodeModal?.code}
            </p>
          </div>
          <div className="flex justify-center">
            <button onClick={handleCopyCode} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 rounded-md transition-colors">
              {copied ? <><Check size={14} className="text-green-600" /> Copied</> : <><Copy size={14} /> Copy code</>}
            </button>
          </div>
          <p className="text-xs text-gray-400">Expires in {pairingCodeModal?.expires}. Single use only.</p>
          <div className="flex justify-end">
            <Button onClick={() => setPairingCodeModal(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Device"
        message="This will permanently delete this device and all its heartbeat history. Are you sure?"
      />
    </div>
  )
}
