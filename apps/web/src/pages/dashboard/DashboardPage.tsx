import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import {
  Ticket, Building2, Monitor, Activity,
  CheckCircle, AlertCircle, Clock, TrendingUp
} from 'lucide-react'

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

export function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    try {
      const [
        { count: ticketsTotal },
        { count: ticketsOpen },
        { count: ticketsPending },
        { count: ticketsInProgress },
        { count: companiesTotal },
        { count: devicesOnline },
        { count: devicesOffline },
        { count: devicesTotal },
        { count: monitorsUp },
        { count: monitorsDown },
        { count: monitorsTotal },
        { count: contractsActive },
      ] = await Promise.all([
        supabase.from('tickets').select('*', { count: 'exact', head: true }),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'online'),
        supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'offline'),
        supabase.from('devices').select('*', { count: 'exact', head: true }),
        supabase.from('monitors').select('*', { count: 'exact', head: true }).eq('last_status', 'up'),
        supabase.from('monitors').select('*', { count: 'exact', head: true }).eq('last_status', 'down'),
        supabase.from('monitors').select('*', { count: 'exact', head: true }),
        supabase.from('contracts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ])

      setStats({
        ticketsTotal: ticketsTotal ?? 0,
        ticketsOpen: ticketsOpen ?? 0,
        ticketsPending: ticketsPending ?? 0,
        ticketsInProgress: ticketsInProgress ?? 0,
        companiesTotal: companiesTotal ?? 0,
        devicesOnline: devicesOnline ?? 0,
        devicesOffline: devicesOffline ?? 0,
        devicesTotal: devicesTotal ?? 0,
        monitorsUp: monitorsUp ?? 0,
        monitorsDown: monitorsDown ?? 0,
        monitorsTotal: monitorsTotal ?? 0,
        contractsActive: contractsActive ?? 0,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const s = stats!
  const monitorUptime = s.monitorsTotal > 0
    ? Math.round((s.monitorsUp / s.monitorsTotal) * 100)
    : 100

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
            value={`${monitorUptime}%`}
            subtitle="Across all monitors"
            icon={<TrendingUp size={20} />}
            color={monitorUptime >= 99 ? 'green' : monitorUptime >= 95 ? 'yellow' : 'red'}
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
    </div>
  )
}
