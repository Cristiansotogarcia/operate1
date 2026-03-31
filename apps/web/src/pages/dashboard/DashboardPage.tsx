import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Ticket, Building2, Monitor, Activity,
  CheckCircle, AlertCircle, Clock, TrendingUp
} from 'lucide-react'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

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

interface StatCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: React.ReactNode
  color: 'violet' | 'green' | 'yellow' | 'red' | 'blue' | 'slate'
  onClick?: () => void
}

function StatCard({ title, value, subtitle, icon, color, onClick }: StatCardProps) {
  const colors = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    red:    'bg-red-50 text-red-600 border-red-100',
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    slate:  'bg-slate-50 text-slate-600 border-slate-100',
  }

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow'
      )}
      onClick={onClick}
    >
      <div className={cn('p-3 rounded-lg border', colors[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

interface SectionHeaderProps {
  icon: React.ReactNode
  title: string
}

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-gray-500">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [ticketTrend, setTicketTrend] = useState<DailyTicket[]>([])
  const [monitorUptime, setMonitorUptime] = useState<MonitorUptimeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      await Promise.all([fetchStats(), fetchTicketTrend(), fetchMonitorUptime()])
    } finally {
      setLoading(false)
    }
  }

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
    // Last 14 days of ticket creation
    const since = new Date()
    since.setDate(since.getDate() - 13)
    const { data } = await supabase
      .from('tickets')
      .select('created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    // Build day buckets
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
        name: m.name.length > 18 ? m.name.slice(0, 16) + '…' : m.name,
        uptime: Number(m.uptime_percent ?? 0),
      }))
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const s = stats!
  const overallUptime = s.monitorsTotal > 0
    ? Math.round((s.monitorsUp / s.monitorsTotal) * 100)
    : 100

  const devicePieData = [
    { name: 'Online', value: s.devicesOnline, fill: '#22c55e' },
    { name: 'Offline', value: s.devicesOffline, fill: '#ef4444' },
  ].filter(d => d.value > 0)

  const ticketStatusData = [
    { name: 'Pending', value: s.ticketsPending, fill: '#eab308' },
    { name: 'Open', value: s.ticketsOpen, fill: '#3b82f6' },
    { name: 'In Progress', value: s.ticketsInProgress, fill: '#8b5cf6' },
  ].filter(d => d.value > 0)

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${profile?.full_name || profile?.username}`}
      />

      {/* Tickets section */}
      <div>
        <SectionHeader icon={<Ticket size={16} />} title="Tickets" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Tickets"
            value={s.ticketsTotal}
            icon={<Ticket size={20} />}
            color="slate"
          />
          <StatCard
            title="Pending"
            value={s.ticketsPending}
            subtitle="Awaiting action"
            icon={<Clock size={20} />}
            color="yellow"
          />
          <StatCard
            title="Open"
            value={s.ticketsOpen}
            subtitle="In queue"
            icon={<AlertCircle size={20} />}
            color="blue"
          />
          <StatCard
            title="In Progress"
            value={s.ticketsInProgress}
            subtitle="Being worked"
            icon={<TrendingUp size={20} />}
            color="violet"
          />
        </div>
      </div>

      {/* Devices section */}
      <div>
        <SectionHeader icon={<Monitor size={16} />} title="Devices" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Online"
            value={s.devicesOnline}
            subtitle={`of ${s.devicesTotal} total`}
            icon={<CheckCircle size={20} />}
            color="green"
          />
          <StatCard
            title="Offline"
            value={s.devicesOffline}
            subtitle="Not reporting"
            icon={<AlertCircle size={20} />}
            color={s.devicesOffline > 0 ? 'red' : 'slate'}
          />
          <StatCard
            title="Total Devices"
            value={s.devicesTotal}
            icon={<Monitor size={20} />}
            color="slate"
          />
        </div>
      </div>

      {/* Monitoring section */}
      <div>
        <SectionHeader icon={<Activity size={16} />} title="Endpoint Monitoring" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Monitors Up"
            value={s.monitorsUp}
            icon={<CheckCircle size={20} />}
            color="green"
          />
          <StatCard
            title="Monitors Down"
            value={s.monitorsDown}
            icon={<AlertCircle size={20} />}
            color={s.monitorsDown > 0 ? 'red' : 'slate'}
          />
          <StatCard
            title="Overall Uptime"
            value={`${overallUptime}%`}
            subtitle="Across all monitors"
            icon={<TrendingUp size={20} />}
            color={overallUptime >= 99 ? 'green' : overallUptime >= 95 ? 'yellow' : 'red'}
          />
          <StatCard
            title="Total Monitors"
            value={s.monitorsTotal}
            icon={<Activity size={20} />}
            color="slate"
          />
        </div>
      </div>

      {/* Companies / Contracts section */}
      <div>
        <SectionHeader icon={<Building2 size={16} />} title="Companies & Contracts" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Companies"
            value={s.companiesTotal}
            icon={<Building2 size={20} />}
            color="slate"
          />
          <StatCard
            title="Active Contracts"
            value={s.contractsActive}
            icon={<CheckCircle size={20} />}
            color="green"
          />
        </div>
      </div>

      {/* Charts section */}
      <div>
        <SectionHeader icon={<TrendingUp size={16} />} title="Charts" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Ticket volume — 14 day trend */}
          <ChartCard title="Ticket Volume — Last 14 Days">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={ticketTrend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#ticketGrad)" strokeWidth={2} name="Tickets" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Monitor uptime bar chart */}
          {monitorUptime.length > 0 ? (
            <ChartCard title="Monitor Uptime %">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monitorUptime} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} width={80} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Uptime']} />
                  <Bar dataKey="uptime" radius={[0, 4, 4, 0]}>
                    {monitorUptime.map((m, i) => (
                      <Cell key={i} fill={m.uptime >= 99 ? '#22c55e' : m.uptime >= 95 ? '#eab308' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="Monitor Uptime %">
              <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No monitors configured yet</div>
            </ChartCard>
          )}

          {/* Ticket status donut */}
          {ticketStatusData.length > 0 ? (
            <ChartCard title="Open Tickets by Status">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={ticketStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {ticketStatusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="Open Tickets by Status">
              <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No open tickets</div>
            </ChartCard>
          )}

          {/* Device online/offline donut */}
          {devicePieData.length > 0 ? (
            <ChartCard title="Device Status">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={devicePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {devicePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          ) : (
            <ChartCard title="Device Status">
              <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No devices registered yet</div>
            </ChartCard>
          )}

        </div>
      </div>
    </div>
  )
}
