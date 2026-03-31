import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { TicketStatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { formatDate, exportToCsv } from '@/lib/utils'
import { Pencil, Trash2, Eye } from 'lucide-react'
import type { Ticket, TicketStatus, Profile } from '@operate1/types'
import toast from 'react-hot-toast'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export function TicketsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [adminUsers, setAdminUsers] = useState<Pick<Profile, 'id' | 'full_name' | 'username'>[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { fetchTickets(); fetchAdmins() }, [statusFilter])

  async function fetchTickets() {
    setLoading(true)
    let q = supabase
      .from('tickets')
      .select('*, company:companies(name), site:sites(name), ticket_type:ticket_types(name), assignee:profiles!tickets_assigned_to_fkey(id,full_name,username)')
      .order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    const { data, error } = await q
    if (error) toast.error(error.message)
    setTickets((data as Ticket[]) || [])
    setLoading(false)
  }

  async function fetchAdmins() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .eq('role', 'admin')
      .eq('status', 'active')
    setAdminUsers(data || [])
  }

  const filtered = tickets.filter(t =>
    !search || [t.contact_email, t.contact_name, t.subject].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    )
  )

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from('tickets').delete().eq('id', deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Ticket deleted')
    fetchTickets()
  }

  async function updateStatus(id: string, status: TicketStatus) {
    const { error } = await supabase.from('tickets').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Status updated')
    fetchTickets()
  }

  async function updateAssignee(id: string, assignedTo: string | null) {
    const { error } = await supabase.from('tickets').update({ assigned_to: assignedTo }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(assignedTo ? 'Ticket assigned' : 'Assignment cleared')
    fetchTickets()
  }

  function handleExport() {
    exportToCsv('tickets.csv', filtered.map(t => ({
      ticket_number: t.ticket_number,
      status: t.status,
      email: t.contact_email,
      contact: t.contact_name,
      company: (t.company as any)?.name,
      site: (t.site as any)?.name,
      type: (t.ticket_type as any)?.name,
      subject: t.subject,
      created: formatDate(t.created_at),
    })))
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Tickets Management"
        count={filtered.length}
        countLabel="ticket(s) found"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>Export CSV</Button>
            <Button size="sm" onClick={() => navigate('/tickets/create')}>New Ticket</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Search Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            placeholder="Email, name, subject..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 col-span-2 md:col-span-1"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md px-3 py-2"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No tickets found" description="Create your first ticket to get started" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Site</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Subject</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(ticket => (
                <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <select
                      value={ticket.status}
                      onChange={e => updateStatus(ticket.id, e.target.value as TicketStatus)}
                      className="text-xs border-0 bg-transparent cursor-pointer"
                      disabled={profile?.role !== 'admin'}
                    >
                      {STATUS_OPTIONS.filter(o => o.value).map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <TicketStatusBadge status={ticket.status} />
                  </td>
                  <td className="px-4 py-3 text-violet-600">{ticket.contact_email}</td>
                  <td className="px-4 py-3 text-gray-700">{ticket.contact_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{(ticket.company as any)?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{(ticket.site as any)?.name || '—'}</td>
                  <td className="px-4 py-3">
                    {(ticket.ticket_type as any)?.name
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">{(ticket.ticket_type as any).name}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{ticket.subject}</td>
                  <td className="px-4 py-3">
                    {profile?.role === 'admin' ? (
                      <select
                        value={ticket.assigned_to || ''}
                        onChange={e => updateAssignee(ticket.id, e.target.value || null)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 max-w-[120px]"
                      >
                        <option value="">Unassigned</option>
                        {adminUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-gray-500 text-xs">
                        {(ticket as any).assignee?.full_name || (ticket as any).assignee?.username || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1 text-gray-400 hover:text-violet-600 transition-colors" title="View">
                        <Eye size={15} />
                      </button>
                      {profile?.role === 'admin' && (
                        <>
                          <button className="p-1 text-gray-400 hover:text-amber-600 transition-colors" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(ticket.id)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Ticket"
        message="Are you sure you want to delete this ticket? This action cannot be undone."
        loading={deleting}
      />
    </div>
  )
}
