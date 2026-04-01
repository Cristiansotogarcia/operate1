import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import type { AuditLog } from '@operate1/types'

const PAGE_SIZE = 50

const ACTION_COLORS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'gray'> = {
  'ticket.created': 'success',
  'ticket.deleted': 'danger',
  'ticket.status_changed': 'info',
  'ticket.assigned': 'warning',
  'ticket.updated': 'gray',
  'device.registered': 'success',
  'device.came_online': 'success',
  'device.went_offline': 'danger',
  'monitor.created': 'success',
  'monitor.status_changed': 'warning',
}

function actionBadge(action: string) {
  const color = ACTION_COLORS[action] ?? 'gray'
  return <Badge variant={color}>{action}</Badge>
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [filterEntity, setFilterEntity] = useState('')
  const [filterAction, setFilterAction] = useState('')

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true)
    let query = supabase
      .from('audit_logs')
      .select('*, actor:profiles!audit_logs_actor_id_fkey(id,full_name,username)')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (filterEntity) query = query.eq('entity_type', filterEntity)
    if (filterAction) query = query.ilike('action', `%${filterAction}%`)

    const { data, error } = await query
    if (!error && data) {
      setLogs(prev => pageNum === 0 ? data as AuditLog[] : [...prev, ...data as AuditLog[]])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false)
  }, [filterEntity, filterAction])

  useEffect(() => {
    setPage(0)
    fetchLogs(0)
  }, [filterEntity, filterAction, fetchLogs])

  function loadMore() {
    const next = page + 1
    setPage(next)
    fetchLogs(next)
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Audit Log"
        subtitle="All system events and mutations"
      />

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">All entity types</option>
          <option value="ticket">Ticket</option>
          <option value="device">Device</option>
          <option value="monitor">Monitor</option>
        </select>
        <input
          type="text"
          placeholder="Filter by action…"
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actor</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap" title={new Date(log.created_at).toLocaleString()}>
                  {timeAgo(log.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {actionBadge(log.action)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-500 text-xs">{log.entity_type}</span>
                  {log.entity_label && (
                    <span className="ml-1 font-medium text-gray-800">{log.entity_label}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.actor
                    ? log.actor.full_name || log.actor.username || '—'
                    : <span className="text-gray-400">system</span>
                  }
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {(log.old_values || log.new_values) ? (
                    <details className="cursor-pointer">
                      <summary className="text-xs text-cyan-600 hover:underline">View diff</summary>
                      <div className="mt-1 text-xs font-mono text-gray-600 space-y-1">
                        {log.old_values && (
                          <div className="text-red-600">- {JSON.stringify(log.old_values)}</div>
                        )}
                        {log.new_values && (
                          <div className="text-green-600">+ {JSON.stringify(log.new_values)}</div>
                        )}
                      </div>
                    </details>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-400">No audit events yet</td>
              </tr>
            )}
          </tbody>
        </table>

        {loading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!loading && hasMore && (
          <div className="px-4 py-3 border-t border-gray-200">
            <button
              onClick={loadMore}
              className="text-sm text-cyan-600 hover:underline"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
