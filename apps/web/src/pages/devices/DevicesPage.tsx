import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DeviceStatusBadge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PageLoader } from '@/components/ui/Spinner'
import { timeAgo } from '@/lib/utils'
import { Monitor, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Device, Company } from '@operate1/types'

export function DevicesPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [devices, setDevices] = useState<Device[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [regKeyModal, setRegKeyModal] = useState<{ name: string; key: string } | null>(null)
  const [form, setForm] = useState({ name: '', company_id: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const channel = supabase.channel('devices-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => { fetchDevices() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: d }, { data: c }] = await Promise.all([
      supabase.from('devices').select('*, company:companies(name)').order('name'),
      supabase.from('companies').select('id, name').order('name'),
    ])
    setDevices((d as Device[]) || [])
    setCompanies((c as Company[]) || [])
    setLoading(false)
  }

  async function fetchDevices() {
    const { data } = await supabase.from('devices').select('*, company:companies(name)').order('name')
    setDevices((data as Device[]) || [])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('devices').insert({
      tenant_id: TENANT_ID,
      name: form.name,
      company_id: form.company_id || null,
    }).select('registration_key, name').single()
    setSaving(false)
    if (error) { toast.error(error.message); return }
    setModalOpen(false)
    setRegKeyModal({ name: data.name, key: data.registration_key })
    fetchDevices()
  }

  function handleCopyKey() {
    if (!regKeyModal) return
    navigator.clipboard.writeText(regKeyModal.key)
    setCopied(true)
    toast.success('Registration key copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  let filtered = devices
  if (search) filtered = filtered.filter(d => [d.name, d.computer_name].some(f => f?.toLowerCase().includes(search.toLowerCase())))
  if (statusFilter) filtered = filtered.filter(d => d.status === statusFilter)

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Devices Management" count={filtered.length} countLabel="device(s) found"
        actions={isAdmin && <Button size="sm" onClick={() => { setForm({ name: '', company_id: '' }); setModalOpen(true) }}>New Device</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Search & Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Device name, computer name..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option><option value="online">Online</option><option value="offline">Offline</option>
          </select>
          <button onClick={() => { setSearch(''); setStatusFilter('') }}
            className="text-sm text-gray-500 border border-gray-300 rounded-md px-3 py-2">Clear Filters</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No devices found" description="Register your first device to get started" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Monitor size={20} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.name}</h3>
                    <p className="text-xs text-violet-500 font-mono">{d.computer_name || 'Pending registration'}</p>
                  </div>
                </div>
                <DeviceStatusBadge status={d.status} />
              </div>

              <div className="space-y-2 mb-3">
                <ProgressBar value={d.cpu_percent ?? 0} label="CPU" />
                <ProgressBar value={d.ram_percent ?? 0} label="RAM" />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                <span>{d.last_ip || '—'}</span>
                <span>{d.last_seen_at ? timeAgo(d.last_seen_at) : 'Never seen'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Device Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Device" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Device Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">None</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Registration Key Modal */}
      <Modal open={!!regKeyModal} onClose={() => setRegKeyModal(null)} title="Registration Key" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Device <strong>{regKeyModal?.name}</strong> created. Copy this registration key and use it to configure the worker agent on the target machine.
          </p>
          <div className="flex items-center gap-2 bg-gray-100 rounded-md p-3">
            <code className="text-xs flex-1 break-all font-mono">{regKeyModal?.key}</code>
            <button onClick={handleCopyKey} className="shrink-0 p-1.5 hover:bg-gray-200 rounded transition-colors">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
            </button>
          </div>
          <p className="text-xs text-amber-600">This key can only be used once. Save it now — it won't be shown again.</p>
          <div className="flex justify-end">
            <Button onClick={() => setRegKeyModal(null)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
