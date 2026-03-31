import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { TicketStatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { sanitizeHtml } from '@/lib/sanitize'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Send } from 'lucide-react'
import type { Ticket, TicketStatus, Profile } from '@operate1/types'
import toast from 'react-hot-toast'

const STATUS_OPTIONS: TicketStatus[] = ['pending', 'open', 'in_progress', 'resolved', 'closed']

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [adminUsers, setAdminUsers] = useState<Pick<Profile, 'id' | 'full_name' | 'username'>[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) { fetchTicket(); fetchComments(); fetchAdmins() }
  }, [id])

  async function fetchTicket() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tickets')
      .select('*, company:companies(name), site:sites(name), ticket_type:ticket_types(name), assignee:profiles!tickets_assigned_to_fkey(id,full_name,username)')
      .eq('id', id!)
      .single()
    if (error) { toast.error(error.message); navigate('/tickets'); return }
    setTicket(data as Ticket)
    setLoading(false)
  }

  async function fetchComments() {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*, author:profiles(full_name,username)')
      .eq('ticket_id', id!)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function fetchAdmins() {
    const { data } = await supabase.from('profiles').select('id,full_name,username').eq('role', 'admin').eq('status', 'active')
    setAdminUsers(data || [])
  }

  async function updateStatus(status: TicketStatus) {
    const { error } = await supabase.from('tickets').update({ status }).eq('id', id!)
    if (error) { toast.error(error.message); return }
    setTicket(t => t ? { ...t, status } : t)
    toast.success('Status updated')
  }

  async function updateAssignee(assignedTo: string | null) {
    const { error } = await supabase.from('tickets').update({ assigned_to: assignedTo }).eq('id', id!)
    if (error) { toast.error(error.message); return }
    setTicket(t => t ? { ...t, assigned_to: assignedTo } : t)
    toast.success(assignedTo ? 'Ticket assigned' : 'Assignment cleared')
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: id!,
      author_id: profile?.id,
      body: commentText.trim(),
      is_internal: isInternal,
    })
    setSubmitting(false)
    if (error) { toast.error(error.message); return }
    setCommentText('')
    fetchComments()
  }

  if (loading) return <PageLoader />
  if (!ticket) return null

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button
          onClick={() => navigate('/tickets')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Tickets
        </button>
      </div>

      <PageHeader
        title={`${ticket.ticket_number} — ${ticket.subject}`}
        actions={
          isAdmin ? (
            <div className="flex items-center gap-2">
              <select
                value={ticket.status}
                onChange={e => updateStatus(e.target.value as TicketStatus)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Description</h3>
            {ticket.description ? (
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(ticket.description) }}
              />
            ) : (
              <p className="text-sm text-gray-400 italic">No description provided.</p>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
              Comments ({comments.length})
            </h3>

            <div className="space-y-4 mb-6">
              {comments.length === 0 && (
                <p className="text-sm text-gray-400 italic">No comments yet.</p>
              )}
              {comments.map(c => (
                <div
                  key={c.id}
                  className={`rounded-lg p-4 ${c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">
                      {c.author?.full_name || c.author?.username || 'Unknown'}
                      {c.is_internal && <span className="ml-2 text-amber-600 text-[10px] font-semibold uppercase">Internal</span>}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>

            {/* Add comment */}
            <form onSubmit={addComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
              <div className="flex items-center justify-between">
                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={e => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300 text-violet-600"
                    />
                    Internal note
                  </label>
                )}
                <Button type="submit" size="sm" loading={submitting} className="ml-auto">
                  <Send size={13} className="mr-1" /> Add Comment
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar meta */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Status</p>
              <TicketStatusBadge status={ticket.status} />
            </div>

            {isAdmin && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Assigned To</p>
                <select
                  value={ticket.assigned_to || ''}
                  onChange={e => updateAssignee(e.target.value || null)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
                >
                  <option value="">Unassigned</option>
                  {adminUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Contact</p>
              <p className="text-sm text-violet-600">{ticket.contact_email}</p>
              {ticket.contact_name && <p className="text-sm text-gray-600">{ticket.contact_name}</p>}
            </div>

            {(ticket.company as any)?.name && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Company</p>
                <p className="text-sm text-gray-700">{(ticket.company as any).name}</p>
              </div>
            )}

            {(ticket.site as any)?.name && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Site</p>
                <p className="text-sm text-gray-700">{(ticket.site as any).name}</p>
              </div>
            )}

            {(ticket.ticket_type as any)?.name && (
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Type</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {(ticket.ticket_type as any).name}
                </span>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Created</p>
              <p className="text-sm text-gray-600">{formatDateTime(ticket.created_at)}</p>
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Last Updated</p>
              <p className="text-sm text-gray-600">{formatDateTime(ticket.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
