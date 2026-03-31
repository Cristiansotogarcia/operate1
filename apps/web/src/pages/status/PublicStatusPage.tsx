import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/ui/Spinner'
import { CheckCircle, XCircle, MinusCircle, Activity } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import type { Monitor } from '@operate1/types'

export function PublicStatusPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  useEffect(() => {
    fetchMonitors()
    // Refresh every 60s
    const interval = setInterval(() => { fetchMonitors() }, 60_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchMonitors() {
    const { data } = await supabase
      .from('monitors')
      .select('*')
      .eq('status', 'active')
      .order('name')
    setMonitors((data as Monitor[]) || [])
    setLastUpdated(new Date())
    setLoading(false)
  }

  const upCount = monitors.filter(m => m.last_status === 'up').length
  const downCount = monitors.filter(m => m.last_status === 'down').length
  const allUp = downCount === 0 && monitors.length > 0
  const overall = monitors.length === 0 ? 'none' : allUp ? 'up' : 'degraded'

  function StatusIcon({ status }: { status: string | null }) {
    if (status === 'up') return <CheckCircle size={18} className="text-green-500 shrink-0" />
    if (status === 'down') return <XCircle size={18} className="text-red-500 shrink-0" />
    return <MinusCircle size={18} className="text-gray-400 shrink-0" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="py-12 text-center text-white"
        style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #312e81 100%)' }}
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <Activity size={28} />
          <h1 className="text-3xl font-bold">Service Status</h1>
        </div>
        <p className="text-white/70 text-sm">Operate1 — Endpoint Monitor Status</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        {/* Overall banner */}
        {!loading && (
          <div className={`rounded-xl p-5 flex items-center gap-4 border ${
            overall === 'up'       ? 'bg-green-50 border-green-200' :
            overall === 'degraded' ? 'bg-red-50 border-red-200' :
                                     'bg-gray-100 border-gray-200'
          }`}>
            {overall === 'up' && <CheckCircle size={28} className="text-green-500 shrink-0" />}
            {overall === 'degraded' && <XCircle size={28} className="text-red-500 shrink-0" />}
            {overall === 'none' && <MinusCircle size={28} className="text-gray-400 shrink-0" />}
            <div>
              <p className="font-semibold text-gray-900">
                {overall === 'up' && 'All systems operational'}
                {overall === 'degraded' && `${downCount} monitor${downCount > 1 ? 's' : ''} reporting issues`}
                {overall === 'none' && 'No monitors configured'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {upCount} up · {downCount} down · Updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}

        {/* Monitor list */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No active monitors to display.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {monitors.map(monitor => (
              <div key={monitor.id} className="flex items-center gap-4 px-5 py-4">
                <StatusIcon status={monitor.last_status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{monitor.name}</p>
                  <p className="text-xs text-gray-400 truncate">{monitor.target}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${
                    monitor.last_status === 'up' ? 'text-green-600' :
                    monitor.last_status === 'down' ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {monitor.last_status?.toUpperCase() ?? 'UNKNOWN'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {monitor.uptime_percent != null ? `${monitor.uptime_percent}% uptime` : '—'}
                  </p>
                  {monitor.last_checked_at && (
                    <p className="text-[10px] text-gray-300 mt-0.5">
                      {timeAgo(monitor.last_checked_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          This page auto-refreshes every 60 seconds.
        </p>
      </div>
    </div>
  )
}
