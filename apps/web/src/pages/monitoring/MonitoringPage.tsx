import { useEffect, useState, useCallback } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { MonitorStatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { timeAgo } from '@/lib/utils'
import { Activity, Globe, Wifi, ChevronDown, ChevronUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import type { Monitor, Device, Company, MonitorResult } from '@operate1/types'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  http: <Globe size={18} className="text-blue-500" />,
  icmp: <Wifi size={18} className="text-green-500" />,
  tcp: <Activity size={18} className="text-purple-500" />,
}

interface CheckPoint { time: string; ms: number | null; status: 'up' | 'down' }

export function MonitoringPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'http', target: '', port: '', device_id: '', company_id: '', interval_seconds: '60' })
  const [saving, setSaving] = useState(false)
  // History panel
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyMap, setHistoryMap] = useState<Record<string, CheckPoint[]>>({})
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const channel = supabase.channel('monitors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitors' }, () => { fetchMonitors() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: m }, { data: d }, { data: c }] = await Promise.all([
      supabase.from('monitors').select('*, device:devices(name), company:companies(name)').order('name'),
      supabase.from('devices').select('id, name').order('name'),
      supabase.from('companies').select('id, name').order('name'),
    ])
    setMonitors((m as Monitor[]) || [])
    setDevices((d as Device[]) || [])
    setCompanies((c as Company[]) || [])
    setLoading(false)
  }

  async function fetchMonitors() {
    const { data } = await supabase.from('monitors').select('*, device:devices(name), company:companies(name)').order('name')
    setMonitors((data as Monitor[]) || [])
  }

  const fetchHistory = useCallback(async (monitorId: string) => {
    if (historyMap[monitorId]) return // already loaded
    setHistoryLoading(true)
    const { data } = await supabase
      .from('monitor_results')
      .select('status, response_ms, checked_at')
      .eq('monitor_id', monitorId)
      .order('checked_at', { ascending: false })
      .limit(50)
    setHistoryLoading(false)
    if (!data) return
    const points: CheckPoint[] = data.reverse().map(r => ({
      time: new Date(r.checked_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      ms: r.response_ms,
      status: r.status as 'up' | 'down',
    }))
    setHistoryMap(prev => ({ ...prev, [monitorId]: points }))
  }, [historyMap])

  function toggleHistory(monitorId: string) {
    if (expandedId === monitorId) {
      setExpandedId(null)
    } else {
      setExpandedId(monitorId)
      fetchHistory(monitorId)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('monitors').insert({
      tenant_id: TENANT_ID,
      name: form.name,
      type: form.type,
      target: form.target,
      port: form.type === 'tcp' ? parseInt(form.port) || null : null,
      device_id: form.device_id || null,
      company_id: form.company_id || null,
      interval_seconds: parseInt(form.interval_seconds) || 60,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Endpoint created')
    setModalOpen(false)
    fetchMonitors()
  }

  let filtered = monitors
  if (search) filtered = filtered.filter(m => [m.name, m.target].some(f => f?.toLowerCase().includes(search.toLowerCase())))
  if (typeFilter) filtered = filtered.filter(m => m.type === typeFilter)
  if (statusFilter) filtered = filtered.filter(m => m.last_status === statusFilter)

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Endpoint Monitoring" count={filtered.length} countLabel="endpoint(s) found"
        actions={isAdmin && <Button size="sm" onClick={() => setModalOpen(true)}>New Endpoint</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Search & Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <input placeholder="Name, URL, IP..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Types</option><option value="http">HTTP</option><option value="icmp">ICMP</option><option value="tcp">TCP</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option><option value="up">Up</option><option value="down">Down</option><option value="unknown">Unknown</option>
          </select>
          <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter('') }}
            className="text-sm text-gray-500 border border-gray-300 rounded-md px-3 py-2">Clear Filters</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No endpoints found" description="Create your first endpoint to start monitoring" /> : (
        <div className="space-y-4">
          {filtered.map(m => {
            const isExpanded = expandedId === m.id
            const history = historyMap[m.id] ?? []
            const downCount = history.filter(h => h.status === 'down').length

            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {TYPE_ICONS[m.type] || <Activity size={18} />}
                      <h3 className="font-semibold text-gray-900">{m.name}</h3>
                    </div>
                    <MonitorStatusBadge status={m.last_status} />
                  </div>
                  <p className="text-xs text-gray-500 mb-4 truncate">{m.target}</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase">Uptime</p>
                      <p className={`text-lg font-bold ${m.uptime_percent > 99 ? 'text-green-600' : m.uptime_percent > 90 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {m.uptime_percent?.toFixed(1) || '0.0'}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase">Avg Response</p>
                      <p className="text-lg font-bold text-gray-700">{m.avg_response_ms || 0} ms</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 uppercase">Failures</p>
                      <p className="text-lg font-bold text-gray-700">{m.failure_count || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <span className="uppercase">{m.type}</span>
                    <div className="flex items-center gap-3">
                      <span>{m.last_checked_at ? timeAgo(m.last_checked_at) : 'Never'}</span>
                      <button
                        onClick={() => toggleHistory(m.id)}
                        className="flex items-center gap-1 text-violet-600 hover:text-violet-700 font-medium"
                      >
                        {isExpanded ? <><ChevronUp size={13} />Hide history</> : <><ChevronDown size={13} />Check history</>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* History panel */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-5">
                    {historyLoading && !historyMap[m.id] ? (
                      <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
                    ) : history.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No check results recorded yet.</p>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-600">Last {history.length} checks</p>
                          <p className="text-xs text-gray-400">{downCount} down · {history.length - downCount} up</p>
                        </div>

                        {/* Response time chart */}
                        <ResponsiveContainer width="100%" height={120}>
                          <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                            <defs>
                              <linearGradient id={`grad-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="ms" />
                            <Tooltip formatter={(v) => v ? [`${v} ms`, 'Response'] : ['—', 'Down']} />
                            <Area
                              type="monotone"
                              dataKey="ms"
                              stroke="#8b5cf6"
                              fill={`url(#grad-${m.id})`}
                              strokeWidth={1.5}
                              connectNulls={false}
                              dot={(props) => {
                                const { cx, cy, payload } = props
                                return payload.status === 'down'
                                  ? <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy || 0} r={4} fill="#ef4444" stroke="white" strokeWidth={1} />
                                  : <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={2} fill="#8b5cf6" stroke="none" />
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>

                        {/* Downtime event list */}
                        {downCount > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-red-600 mb-1">Down events</p>
                            <div className="space-y-1">
                              {history.filter(h => h.status === 'down').slice(-5).map((h, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                                  <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                  <span>{h.time} — check failed</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Endpoint" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="http">HTTP</option><option value="icmp">ICMP (Ping)</option><option value="tcp">TCP Port</option>
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Target (URL/Host) *</label>
              <input required placeholder={form.type === 'http' ? 'https://example.com' : 'hostname or IP'} value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
            {form.type === 'tcp' && (
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Port *</label>
                <input required type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Device</label>
              <select value={form.device_id} onChange={e => setForm(f => ({ ...f, device_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">All Devices</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">None</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Interval (seconds)</label>
              <input type="number" min="10" value={form.interval_seconds} onChange={e => setForm(f => ({ ...f, interval_seconds: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
