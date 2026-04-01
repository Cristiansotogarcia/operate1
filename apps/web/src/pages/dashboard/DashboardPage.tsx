import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Ticket, Building2, Monitor, Activity,
  CheckCircle, AlertCircle, Clock, TrendingUp,
  ArrowRight, RefreshCw, ChevronDown, Search,
  CircleDot, Wifi, WifiOff, FileText, ExternalLink,
  Shield, Zap, Battery, BatteryCharging, Plug, HardDrive,
} from 'lucide-react'

/* ───────────── types ───────────── */

interface DashboardStats {
  ticketsOpen: number
  ticketsPending: number
  ticketsInProgress: number
  ticketsTotal: number
  companiesTotal: number
  devicesOnline: number
  devicesOffline: number
  devicesTotal: number
  monitorsUp: number
  monitorsDown: number
  monitorsTotal: number
  contractsActive: number
}

interface DailyTicket { date: string; count: number }
interface MonitorUptimeRow { name: string; uptime: number }
interface LiveMonitor { id: string; name: string; target: string; type: string; last_status: 'up' | 'down' | 'unknown'; uptime_percent: number; avg_response_ms: number }
interface CompanyRow { id: string; name: string; status: string; contracts: { id: string; status: string }[]; sites: { id: string }[] }
interface RecentTicket { id: string; title: string; status: string; priority: string; created_at: string; company: { name: string } | null }
interface DeviceRow { id: string; name: string; status: string; cpu_percent: number | null; ram_percent: number | null; disk_percent: number | null; battery_percent: number | null; battery_charging: boolean | null; power_source: string | null; smart_status: string | null; disk_type: string | null; agent_version: string | null; last_seen_at: string | null }

/* ───────────── sub-components ───────────── */

interface StatCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  color: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'slate'
  onClick?: () => void
  trend?: string
}

function StatCard({ title, value, subtitle, icon, color, onClick, trend }: StatCardProps) {
  const bg: Record<string, string> = {
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    green:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red:    'bg-red-500/15 text-red-400 border-red-500/30',
    blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    slate:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-slate-800/80 rounded-xl border border-white/10 p-5 flex items-center gap-4 w-full text-left transition-all duration-200',
        onClick && 'hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 group cursor-pointer',
        !onClick && 'cursor-default'
      )}
    >
      <div className={cn('p-3 rounded-xl border', bg[color])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        {trend && <p className="text-xs text-emerald-500 font-medium mt-0.5">{trend}</p>}
      </div>
      {onClick && (
        <ArrowRight size={16} className="text-slate-600 group-hover:text-cyan-500 transition-colors shrink-0" />
      )}
    </button>
  )
}

function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h2>
      </div>
      {action}
    </div>
  )
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-slate-800/80 rounded-xl border border-white/10 p-5', className)}>
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function PulseDot({ color }: { color: 'green' | 'red' | 'gray' }) {
  const cls = color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-red-500' : 'bg-gray-400'
  return (
    <span className="relative flex h-2.5 w-2.5">
      {color !== 'gray' && <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-50', cls)} />}
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', cls)} />
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:     { label: 'Pending',     cls: 'bg-amber-500/15 text-amber-400' },
    open:        { label: 'Open',        cls: 'bg-blue-500/15 text-blue-400' },
    in_progress: { label: 'In Progress', cls: 'bg-cyan-500/15 text-cyan-400' },
    resolved:    { label: 'Resolved',    cls: 'bg-emerald-500/15 text-emerald-400' },
    closed:      { label: 'Closed',      cls: 'bg-white/10 text-slate-500' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-white/10 text-slate-500' }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', cls)}>{label}</span>
}

function PriorityDot({ priority }: { priority: string }) {
  const cls = priority === 'critical' ? 'bg-red-500' : priority === 'high' ? 'bg-orange-500' : priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
  return <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', cls)} title={priority} />
}

/* ───────────── companies dropdown ───────────── */

function CompaniesDropdown({ companies, navigate }: { companies: CompanyRow[]; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 bg-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
      >
        <Building2 size={14} />
        Quick Access
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-800/80 rounded-xl border border-white/10 shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
              <Search size={14} className="text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search companies..."
                className="bg-transparent text-sm text-slate-300 placeholder-gray-400 outline-none flex-1"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">No companies found</p>
            )}
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => { navigate(`/companies/${c.id}`); setOpen(false) }}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-cyan-50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate group-hover:text-cyan-700">{c.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {c.contracts?.length ?? 0} contract{c.contracts?.length !== 1 ? 's' : ''} &middot; {c.sites?.length ?? 0} site{c.sites?.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <ExternalLink size={12} className="text-slate-600 group-hover:text-cyan-500 shrink-0" />
              </button>
            ))}
          </div>
          <div className="border-t border-white/5 p-2">
            <button
              type="button"
              onClick={() => { navigate('/companies'); setOpen(false) }}
              className="w-full text-center text-xs font-medium text-cyan-600 hover:text-cyan-700 py-1.5 rounded-lg hover:bg-cyan-50 transition-colors"
            >
              View All Companies
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────────── main dashboard ───────────── */

export function DashboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [ticketTrend, setTicketTrend] = useState<DailyTicket[]>([])
  const [monitorUptime, setMonitorUptime] = useState<MonitorUptimeRow[]>([])
  const [liveMonitors, setLiveMonitors] = useState<LiveMonitor[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])
  const [deviceFleet, setDeviceFleet] = useState<DeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  /* ── data fetching ── */

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      await Promise.all([
        fetchStats(),
        fetchTicketTrend(),
        fetchMonitorUptime(),
        fetchLiveMonitors(),
        fetchCompanies(),
        fetchRecentTickets(),
        fetchDeviceFleet(),
      ])
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  async function fetchStats() {
    const { data } = await supabase.rpc('get_dashboard_stats', { p_tenant_id: TENANT_ID })
    const d = (data ?? {}) as Record<string, number>
    setStats({
      ticketsTotal:      d.tickets_total       ?? 0,
      ticketsOpen:       d.tickets_open        ?? 0,
      ticketsPending:    d.tickets_pending     ?? 0,
      ticketsInProgress: d.tickets_in_progress ?? 0,
      companiesTotal:    d.companies_total     ?? 0,
      devicesOnline:     d.devices_online      ?? 0,
      devicesOffline:    d.devices_offline     ?? 0,
      devicesTotal:      d.devices_total       ?? 0,
      monitorsUp:        d.monitors_up         ?? 0,
      monitorsDown:      d.monitors_down       ?? 0,
      monitorsTotal:     d.monitors_total      ?? 0,
      contractsActive:   d.contracts_active    ?? 0,
    })
  }

  async function fetchTicketTrend() {
    const since = new Date()
    since.setDate(since.getDate() - 13)
    const { data } = await supabase
      .from('tickets')
      .select('created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })
    const buckets: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      buckets[d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })] = 0
    }
    data?.forEach(t => {
      const key = new Date(t.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
      if (key in buckets) buckets[key]++
    })
    setTicketTrend(Object.entries(buckets).map(([date, count]) => ({ date, count })))
  }

  async function fetchMonitorUptime() {
    const { data } = await supabase
      .from('monitors')
      .select('name, uptime_percent')
      .order('uptime_percent', { ascending: true })
      .limit(8)
    setMonitorUptime(
      (data ?? []).map(m => ({
        name: m.name.length > 18 ? m.name.slice(0, 16) + '\u2026' : m.name,
        uptime: Number(m.uptime_percent ?? 0),
      }))
    )
  }

  async function fetchLiveMonitors() {
    const { data } = await supabase
      .from('monitors')
      .select('id, name, target, type, last_status, uptime_percent, avg_response_ms')
      .order('last_status', { ascending: true })
      .limit(10)
    setLiveMonitors((data as LiveMonitor[]) ?? [])
  }

  async function fetchCompanies() {
    const { data } = await supabase
      .from('companies')
      .select('id, name, status, contracts(id, status), sites(id)')
      .order('name')
    setCompanies((data as unknown as CompanyRow[]) ?? [])
  }

  async function fetchRecentTickets() {
    const { data } = await supabase
      .from('tickets')
      .select('id, title, status, priority, created_at, company:companies(name)')
      .order('created_at', { ascending: false })
      .limit(6)
    setRecentTickets((data as unknown as RecentTicket[]) ?? [])
  }

  async function fetchDeviceFleet() {
    const { data } = await supabase
      .from('devices')
      .select('id, name, status, cpu_percent, ram_percent, disk_percent, battery_percent, battery_charging, power_source, smart_status, disk_type, agent_version, last_seen_at')
      .order('status', { ascending: true })
      .limit(8)
    setDeviceFleet((data as DeviceRow[]) ?? [])
  }

  /* ── lifecycle & realtime ── */

  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchAll(true), 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // Realtime subscriptions for live updates
  useEffect(() => {
    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitors' }, () => {
        fetchStats()
        fetchLiveMonitors()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchStats()
        fetchRecentTickets()
        fetchTicketTrend()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => {
        fetchStats()
        fetchDeviceFleet()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  /* ── loading state ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-cyan-200 border-t-cyan-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-3">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const s = stats!

  /* ── derived data ── */

  const overallUptime = s.monitorsTotal > 0
    ? Math.round((s.monitorsUp / s.monitorsTotal) * 100)
    : 100

  const devicePieData = [
    { name: 'Online', value: s.devicesOnline, fill: '#10b981' },
    { name: 'Offline', value: s.devicesOffline, fill: '#ef4444' },
  ].filter(d => d.value > 0)

  const ticketStatusData = [
    { name: 'Pending', value: s.ticketsPending, fill: '#f59e0b' },
    { name: 'Open', value: s.ticketsOpen, fill: '#3b82f6' },
    { name: 'In Progress', value: s.ticketsInProgress, fill: '#06b6d4' },
  ].filter(d => d.value > 0)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const systemHealthy = s.monitorsDown === 0 && s.devicesOffline === 0

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {greeting}, {profile?.full_name?.split(' ')[0] || profile?.username}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here&apos;s your operations overview for today
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
          <CompaniesDropdown companies={companies} navigate={navigate} />
          <button
            type="button"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 bg-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            Refresh
          </button>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <PulseDot color="green" />
            <span>Live &middot; {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* ── System Health Bar ── */}
      <div className={cn(
        'rounded-xl border px-5 py-3.5 flex items-center gap-3 transition-colors',
        systemHealthy
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
      )}>
        {systemHealthy ? <Shield size={18} /> : <AlertCircle size={18} />}
        <span className="text-sm font-medium">
          {systemHealthy
            ? 'All systems operational — no alerts detected'
            : `${s.monitorsDown} monitor${s.monitorsDown !== 1 ? 's' : ''} down, ${s.devicesOffline} device${s.devicesOffline !== 1 ? 's' : ''} offline`
          }
        </span>
        {!systemHealthy && (
          <button
            type="button"
            onClick={() => navigate('/monitoring')}
            className="ml-auto text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            View details
          </button>
        )}
      </div>

      {/* ── Tickets ── */}
      <div>
        <SectionHeader
          icon={<Ticket size={15} />}
          title="Tickets"
          action={
            <button
              type="button"
              onClick={() => navigate('/tickets/create')}
              className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              + New Ticket
            </button>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tickets"
            value={s.ticketsTotal}
            icon={<Ticket size={20} />}
            color="slate"
            onClick={() => navigate('/tickets')}
          />
          <StatCard
            title="Pending"
            value={s.ticketsPending}
            subtitle="Awaiting action"
            icon={<Clock size={20} />}
            color="yellow"
            onClick={() => navigate('/tickets')}
          />
          <StatCard
            title="Open"
            value={s.ticketsOpen}
            subtitle="In queue"
            icon={<AlertCircle size={20} />}
            color="blue"
            onClick={() => navigate('/tickets')}
          />
          <StatCard
            title="In Progress"
            value={s.ticketsInProgress}
            subtitle="Being worked"
            icon={<TrendingUp size={20} />}
            color="cyan"
            onClick={() => navigate('/tickets')}
          />
        </div>
      </div>

      {/* ── Two-column: Live Monitors + Recent Tickets ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Live Monitor Status */}
        <div className="bg-slate-800/80 rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <PulseDot color={s.monitorsDown > 0 ? 'red' : 'green'} />
              <h3 className="text-sm font-semibold text-slate-300">Live Monitors</h3>
              <span className="text-[10px] font-medium text-slate-500 bg-white/10 px-1.5 py-0.5 rounded-full">{s.monitorsTotal}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/monitoring')}
              className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
            {liveMonitors.length === 0 && (
              <div className="flex items-center justify-center py-10 text-sm text-slate-500">No monitors configured</div>
            )}
            {liveMonitors.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate('/monitoring')}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5/80 transition-colors text-left group"
              >
                <PulseDot color={m.last_status === 'up' ? 'green' : m.last_status === 'down' ? 'red' : 'gray'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate group-hover:text-cyan-600">{m.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{m.target}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    'text-xs font-semibold tabular-nums',
                    m.last_status === 'up' ? 'text-emerald-600' : m.last_status === 'down' ? 'text-red-600' : 'text-slate-500'
                  )}>
                    {m.last_status === 'up' ? 'UP' : m.last_status === 'down' ? 'DOWN' : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 tabular-nums">
                    {m.avg_response_ms > 0 ? `${Math.round(m.avg_response_ms)}ms` : '—'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Tickets Feed */}
        <div className="bg-slate-800/80 rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-300">Recent Activity</h3>
            </div>
            <button
              type="button"
              onClick={() => navigate('/tickets')}
              className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
            {recentTickets.length === 0 && (
              <div className="flex items-center justify-center py-10 text-sm text-slate-500">No tickets yet</div>
            )}
            {recentTickets.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5/80 transition-colors text-left group"
              >
                <PriorityDot priority={t.priority} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-300 truncate group-hover:text-cyan-600">{t.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {t.company?.name ?? 'Unassigned'} &middot; {timeAgo(t.created_at)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Devices + Monitoring stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Devices */}
        <div>
          <SectionHeader icon={<Monitor size={15} />} title="Devices" />
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              title="Online"
              value={s.devicesOnline}
              subtitle={`of ${s.devicesTotal}`}
              icon={<Wifi size={20} />}
              color="green"
              onClick={() => navigate('/devices')}
            />
            <StatCard
              title="Offline"
              value={s.devicesOffline}
              subtitle="Not reporting"
              icon={<WifiOff size={20} />}
              color={s.devicesOffline > 0 ? 'red' : 'slate'}
              onClick={() => navigate('/devices')}
            />
            <StatCard
              title="Total"
              value={s.devicesTotal}
              icon={<Monitor size={20} />}
              color="slate"
              onClick={() => navigate('/devices')}
            />
          </div>
        </div>

        {/* Monitoring */}
        <div>
          <SectionHeader icon={<Activity size={15} />} title="Monitoring" />
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              title="Up"
              value={s.monitorsUp}
              icon={<CheckCircle size={20} />}
              color="green"
              onClick={() => navigate('/monitoring')}
            />
            <StatCard
              title="Down"
              value={s.monitorsDown}
              icon={<AlertCircle size={20} />}
              color={s.monitorsDown > 0 ? 'red' : 'slate'}
              onClick={() => navigate('/monitoring')}
            />
            <StatCard
              title="Uptime"
              value={`${overallUptime}%`}
              icon={<TrendingUp size={20} />}
              color={overallUptime >= 99 ? 'green' : overallUptime >= 95 ? 'yellow' : 'red'}
              onClick={() => navigate('/monitoring')}
            />
          </div>
        </div>
      </div>

      {/* ── Device Fleet Overview ── */}
      {deviceFleet.length > 0 && (
        <div>
          <SectionHeader
            icon={<HardDrive size={15} />}
            title="Device Fleet"
            action={
              <button type="button" onClick={() => navigate('/devices')}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors">
                View All
              </button>
            }
          />
          <div className="bg-slate-800/80 rounded-xl border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/5 max-h-[320px] overflow-y-auto">
              {deviceFleet.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => navigate('/devices')}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5/80 transition-colors text-left group"
                >
                  <PulseDot color={d.status === 'online' ? 'green' : 'red'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-300 truncate group-hover:text-cyan-600">{d.name}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      {d.cpu_percent != null && <span>CPU {d.cpu_percent}%</span>}
                      {d.ram_percent != null && <span>RAM {d.ram_percent}%</span>}
                      {d.disk_percent != null && <span>Disk {d.disk_percent}%</span>}
                      {d.disk_type && <span className="text-slate-600">{d.disk_type}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Battery indicator */}
                    {d.battery_percent != null && (
                      <div className="flex items-center gap-1 text-[11px]">
                        {d.battery_charging
                          ? <BatteryCharging size={14} className="text-emerald-500" />
                          : <Battery size={14} className={d.battery_percent < 20 ? 'text-red-500' : 'text-slate-500'} />
                        }
                        <span className={cn(
                          'tabular-nums font-medium',
                          d.battery_percent < 20 ? 'text-red-500' : 'text-slate-500'
                        )}>
                          {d.battery_percent}%
                        </span>
                      </div>
                    )}
                    {/* Power source */}
                    {d.power_source && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        d.power_source === 'ac' ? 'bg-emerald-500/15 text-emerald-400' :
                        d.power_source === 'ups' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      )}>
                        {d.power_source === 'ac' ? 'AC' : d.power_source === 'ups' ? 'UPS' : 'BATT'}
                      </span>
                    )}
                    {/* SMART status */}
                    {d.smart_status && d.smart_status !== 'ok' && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        d.smart_status === 'failing' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
                      )}>
                        {d.smart_status === 'failing' ? 'DISK FAIL' : 'DISK WARN'}
                      </span>
                    )}
                    {/* Agent version */}
                    {d.agent_version && (
                      <span className="text-[10px] text-slate-600">v{d.agent_version}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Companies & Contracts ── */}
      <div>
        <SectionHeader
          icon={<Building2 size={15} />}
          title="Companies & Contracts"
          action={
            <button
              type="button"
              onClick={() => navigate('/companies')}
              className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              Manage
            </button>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Companies"
            value={s.companiesTotal}
            icon={<Building2 size={20} />}
            color="slate"
            onClick={() => navigate('/companies')}
          />
          <StatCard
            title="Active Contracts"
            value={s.contractsActive}
            icon={<FileText size={20} />}
            color="green"
            onClick={() => navigate('/contracts')}
          />
        </div>
      </div>

      {/* ── Charts ── */}
      <div>
        <SectionHeader icon={<TrendingUp size={15} />} title="Analytics" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Ticket trend */}
          <ChartCard title="Ticket Volume — Last 14 Days">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={ticketTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                />
                <Area type="monotone" dataKey="count" stroke="#06b6d4" fill="url(#ticketGrad)" strokeWidth={2.5} name="Tickets" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Monitor uptime bar chart */}
          <ChartCard title="Monitor Uptime %">
            {monitorUptime.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monitorUptime} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} unit="%" axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} width={80} axisLine={false} />
                  <Tooltip
                    formatter={(v) => [`${v}%`, 'Uptime']}
                    contentStyle={{ borderRadius: '8px', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                  />
                  <Bar dataKey="uptime" radius={[0, 6, 6, 0]}>
                    {monitorUptime.map((m, i) => (
                      <Cell key={i} fill={m.uptime >= 99 ? '#10b981' : m.uptime >= 95 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-slate-500">No monitors configured yet</div>
            )}
          </ChartCard>

          {/* Ticket status donut */}
          <ChartCard title="Open Tickets by Status">
            {ticketStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ticketStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {ticketStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-slate-500">No open tickets</div>
            )}
          </ChartCard>

          {/* Device donut */}
          <ChartCard title="Device Status">
            {devicePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={devicePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} dataKey="value" paddingAngle={4} strokeWidth={0}>
                    {devicePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-slate-500">No devices registered yet</div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
