import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Download, FileText, Activity, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

type ReportType = 'tickets' | 'time' | 'monitors' | 'devices'

interface ReportConfig {
  type: ReportType
  label: string
  description: string
  icon: React.ReactNode
}

const REPORTS: ReportConfig[] = [
  {
    type: 'tickets',
    label: 'Tickets Report',
    description: 'All tickets with status, assignee, company, time logged, and SLA breach flag.',
    icon: <FileText size={20} />,
  },
  {
    type: 'time',
    label: 'Time Tracking Report',
    description: 'Time entries per ticket, technician, and billable/non-billable breakdown.',
    icon: <Clock size={20} />,
  },
  {
    type: 'monitors',
    label: 'Monitor Uptime Report',
    description: 'All monitors with uptime %, average response time, and failure count.',
    icon: <Activity size={20} />,
  },
  {
    type: 'devices',
    label: 'Devices Report',
    description: 'All registered devices with status, last seen, and metrics snapshot.',
    icon: <Activity size={20} />,
  },
]

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(',')]
  rows.forEach(row => lines.push(row.map(escapeCSV).join(',')))
  return lines.join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportingPage() {
  const [loading, setLoading] = useState<ReportType | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))

  async function generate(type: ReportType) {
    setLoading(type)
    try {
      const from = `${dateFrom}T00:00:00.000Z`
      const to = `${dateTo}T23:59:59.999Z`

      if (type === 'tickets') {
        const { data, error } = await supabase
          .from('tickets')
          .select('ticket_number, subject, status, priority, contact_email, contact_name, sla_breached, created_at, updated_at, company:companies(name), site:sites(name), ticket_type:ticket_types(name), assignee:profiles!tickets_assigned_to_fkey(full_name,username)')
          .gte('created_at', from)
          .lte('created_at', to)
          .order('created_at', { ascending: false })
        if (error) throw error

        const headers = ['Ticket #', 'Subject', 'Status', 'Priority', 'Contact Email', 'Contact Name', 'Company', 'Site', 'Type', 'Assigned To', 'SLA Breached', 'Created', 'Updated']
        const rows = (data ?? []).map(t => [
          t.ticket_number,
          t.subject,
          t.status,
          t.priority,
          t.contact_email,
          t.contact_name,
          (t.company as any)?.name ?? '',
          (t.site as any)?.name ?? '',
          (t.ticket_type as any)?.name ?? '',
          (t.assignee as any)?.full_name || (t.assignee as any)?.username || '',
          t.sla_breached ? 'Yes' : 'No',
          new Date(t.created_at).toLocaleString(),
          new Date(t.updated_at).toLocaleString(),
        ])
        downloadCSV(`tickets-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
        toast.success(`${data?.length ?? 0} tickets exported`)
      }

      else if (type === 'time') {
        const { data, error } = await supabase
          .from('time_entries')
          .select('minutes, billable, description, logged_at, ticket:tickets(ticket_number,subject), technician:profiles(full_name,username)')
          .gte('logged_at', from)
          .lte('logged_at', to)
          .order('logged_at', { ascending: false })
        if (error) throw error

        const headers = ['Ticket #', 'Subject', 'Technician', 'Minutes', 'Hours', 'Billable', 'Description', 'Logged At']
        const rows = (data ?? []).map(e => [
          (e.ticket as any)?.ticket_number ?? '',
          (e.ticket as any)?.subject ?? '',
          (e.technician as any)?.full_name || (e.technician as any)?.username || '',
          e.minutes,
          (e.minutes / 60).toFixed(2),
          e.billable ? 'Yes' : 'No',
          e.description ?? '',
          new Date(e.logged_at).toLocaleString(),
        ])
        const totalMin = (data ?? []).reduce((s, e) => s + e.minutes, 0)
        rows.push(['', '', 'TOTAL', totalMin, (totalMin / 60).toFixed(2), '', '', ''])
        downloadCSV(`time-entries-${dateFrom}-${dateTo}.csv`, toCSV(headers, rows))
        toast.success(`${data?.length ?? 0} entries exported`)
      }

      else if (type === 'monitors') {
        const { data, error } = await supabase
          .from('monitors')
          .select('name, type, target, last_status, uptime_percent, avg_response_ms, failure_count, last_checked_at, company:companies(name)')
          .order('name')
        if (error) throw error

        const headers = ['Name', 'Type', 'Target', 'Status', 'Uptime %', 'Avg Response (ms)', 'Failures', 'Last Checked', 'Company']
        const rows = (data ?? []).map(m => [
          m.name,
          m.type,
          m.target,
          m.last_status,
          m.uptime_percent,
          m.avg_response_ms,
          m.failure_count,
          m.last_checked_at ? new Date(m.last_checked_at).toLocaleString() : '',
          (m.company as any)?.name ?? '',
        ])
        downloadCSV(`monitors-${new Date().toISOString().slice(0,10)}.csv`, toCSV(headers, rows))
        toast.success(`${data?.length ?? 0} monitors exported`)
      }

      else if (type === 'devices') {
        const { data, error } = await supabase
          .from('devices')
          .select('name, computer_name, os, status, last_ip, cpu_percent, ram_percent, disk_percent, last_seen_at, company:companies(name)')
          .order('name')
        if (error) throw error

        const headers = ['Name', 'Computer Name', 'OS', 'Status', 'Last IP', 'CPU %', 'RAM %', 'Disk %', 'Last Seen', 'Company']
        const rows = (data ?? []).map(d => [
          d.name,
          d.computer_name ?? '',
          d.os ?? '',
          d.status,
          d.last_ip ?? '',
          d.cpu_percent ?? '',
          d.ram_percent ?? '',
          d.disk_percent ?? '',
          d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '',
          (d.company as any)?.name ?? '',
        ])
        downloadCSV(`devices-${new Date().toISOString().slice(0,10)}.csv`, toCSV(headers, rows))
        toast.success(`${data?.length ?? 0} devices exported`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Export failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Reporting"
        subtitle="Export data as CSV for analysis and billing"
      />

      {/* Date range (for time-based reports) */}
      <div className="flex items-center gap-4 mb-8 bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700">Date range:</p>
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <p className="text-xs text-gray-400 ml-2">Used for tickets and time entry reports</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map(report => (
          <div key={report.type} className="bg-white border border-gray-200 rounded-lg p-5 flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-violet-50 rounded-lg text-violet-600">
                {report.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{report.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5 max-w-xs">{report.description}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => generate(report.type)}
              disabled={loading === report.type}
              className="shrink-0 ml-4"
            >
              {loading === report.type ? (
                <Spinner size="sm" />
              ) : (
                <><Download size={14} className="mr-1" /> Export CSV</>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
