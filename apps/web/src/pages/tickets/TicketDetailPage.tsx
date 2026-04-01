import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, TicketStatusBadge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/Spinner'
import { sanitizeHtml } from '@/lib/sanitize'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Send, Clock, Paperclip, Upload, Download, Trash2 } from 'lucide-react'
import type { Ticket, TicketStatus, Profile, TimeEntry, TicketAttachment, TicketPriority } from '@operate1/types'
import toast from 'react-hot-toast'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'
const STATUS_OPTIONS: TicketStatus[] = ['pending', 'open', 'in_progress', 'resolved', 'closed']
const PRIORITY_COLORS: Record<TicketPriority, 'gray' | 'info' | 'warning' | 'danger'> = {
  low: 'gray', normal: 'info', high: 'warning', critical: 'danger',
}

type Tab = 'comments' | 'time' | 'attachments'

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [adminUsers, setAdminUsers] = useState<Pick<Profile, 'id' | 'full_name' | 'username'>[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [attachments, setAttachments] = useState<TicketAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('comments')
  // Time entry form
  const [timeDesc, setTimeDesc] = useState('')
  const [timeMinutes, setTimeMinutes] = useState(30)
  const [timeBillable, setTimeBillable] = useState(true)
  const [addingTime, setAddingTime] = useState(false)
  // Attachment upload
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchTicket()
      fetchComments()
      fetchAdmins()
      fetchTimeEntries()
      fetchAttachments()
    }
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

  async function fetchTimeEntries() {
    const { data } = await supabase
      .from('time_entries')
      .select('*, technician:profiles(full_name,username)')
      .eq('ticket_id', id!)
      .order('logged_at', { ascending: false })
    setTimeEntries((data || []) as TimeEntry[])
  }

  async function fetchAttachments() {
    const { data } = await supabase
      .from('ticket_attachments')
      .select('*')
      .eq('ticket_id', id!)
      .order('created_at', { ascending: false })
    setAttachments((data || []) as TicketAttachment[])
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

  async function logTime(e: React.FormEvent) {
    e.preventDefault()
    if (!timeMinutes || timeMinutes < 1) return
    setAddingTime(true)
    const { error } = await supabase.from('time_entries').insert({
      tenant_id: TENANT_ID,
      ticket_id: id!,
      technician_id: profile?.id,
      description: timeDesc.trim() || null,
      minutes: timeMinutes,
      billable: timeBillable,
    })
    setAddingTime(false)
    if (error) { toast.error(error.message); return }
    setTimeDesc('')
    setTimeMinutes(30)
    toast.success('Time logged')
    fetchTimeEntries()
  }

  async function deleteTimeEntry(entryId: string) {
    await supabase.from('time_entries').delete().eq('id', entryId)
    fetchTimeEntries()
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
    if (file.size > MAX_BYTES) {
      toast.error(`File too large — maximum 5 MB (free plan limit)`)
      e.target.value = ''
      return
    }
    setUploading(true)
    const path = `${TENANT_ID}/${id}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage
      .from('ticket-attachments')
      .upload(path, file)
    if (upErr) {
      toast.error('Upload failed: ' + upErr.message)
      setUploading(false)
      return
    }
    await supabase.from('ticket_attachments').insert({
      tenant_id: TENANT_ID,
      ticket_id: id!,
      uploaded_by: profile?.id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: path,
    })
    setUploading(false)
    e.target.value = ''
    toast.success('File uploaded')
    fetchAttachments()
  }

  async function downloadFile(att: TicketAttachment) {
    const { data } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(att.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteAttachment(att: TicketAttachment) {
    await supabase.storage.from('ticket-attachments').remove([att.storage_path])
    await supabase.from('ticket_attachments').delete().eq('id', att.id)
    fetchAttachments()
  }

  function formatMinutes(m: number) {
    const h = Math.floor(m / 60)
    const min = m % 60
    return h > 0 ? `${h}h ${min > 0 ? `${min}m` : ''}`.trim() : `${min}m`
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  if (loading) return <PageLoader />
  if (!ticket) return null

  const isAdmin = profile?.role === 'admin'
  const totalMinutes = timeEntries.reduce((s, e) => s + e.minutes, 0)

  return (
    <div className="max-w-4xl mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
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

          {/* Tabs: Comments / Time / Attachments */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {(['comments', 'time', 'attachments'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-cyan-600 text-cyan-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'comments' && `Comments (${comments.length})`}
                  {tab === 'time' && `Time (${formatMinutes(totalMinutes)})`}
                  {tab === 'attachments' && `Files (${attachments.length})`}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Comments tab */}
              {activeTab === 'comments' && (
                <div>
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

                  <form onSubmit={addComment} className="space-y-3">
                    <textarea
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      {isAdmin && (
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isInternal}
                            onChange={e => setIsInternal(e.target.checked)}
                            className="rounded border-gray-300 text-cyan-600"
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
              )}

              {/* Time tracking tab */}
              {activeTab === 'time' && (
                <div>
                  {timeEntries.length > 0 && (
                    <div className="mb-6 space-y-2">
                      {timeEntries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <Clock size={14} className="text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {formatMinutes(entry.minutes)}
                                {!entry.billable && <span className="ml-2 text-xs text-gray-400">(non-billable)</span>}
                              </p>
                              {entry.description && <p className="text-xs text-gray-500">{entry.description}</p>}
                              <p className="text-xs text-gray-400">
                                {(entry as any).technician?.full_name || (entry as any).technician?.username || 'Unknown'} · {formatDateTime(entry.logged_at)}
                              </p>
                            </div>
                          </div>
                          {isAdmin && (
                            <button onClick={() => deleteTimeEntry(entry.id)} className="text-gray-300 hover:text-red-400">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="pt-2 text-sm font-semibold text-gray-700">
                        Total: {formatMinutes(totalMinutes)}
                      </div>
                    </div>
                  )}

                  <form onSubmit={logTime} className="space-y-3 border-t border-gray-100 pt-4">
                    <h4 className="text-sm font-medium text-gray-700">Log Time</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={timeDesc}
                          onChange={e => setTimeDesc(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <div className="w-full sm:w-28">
                        <input
                          type="number"
                          min={1}
                          value={timeMinutes}
                          onChange={e => setTimeMinutes(parseInt(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          placeholder="Minutes"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={timeBillable}
                          onChange={e => setTimeBillable(e.target.checked)}
                          className="rounded border-gray-300 text-cyan-600"
                        />
                        Billable
                      </label>
                      <Button type="submit" size="sm" loading={addingTime} disabled={!timeMinutes || timeMinutes < 1}>
                        <Clock size={13} className="mr-1" /> Log Time
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Attachments tab */}
              {activeTab === 'attachments' && (
                <div>
                  {attachments.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {attachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                          <div className="flex items-center gap-2">
                            <Paperclip size={14} className="text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-800">{att.file_name}</p>
                              <p className="text-xs text-gray-400">{formatFileSize(att.file_size)} · {formatDateTime(att.created_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => downloadFile(att)} className="text-gray-400 hover:text-cyan-600">
                              <Download size={14} />
                            </button>
                            {isAdmin && (
                              <button onClick={() => deleteAttachment(att)} className="text-gray-400 hover:text-red-400">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-cyan-600 hover:text-cyan-700 font-medium">
                      <Upload size={15} />
                      {uploading ? 'Uploading…' : 'Upload File'}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploading}
                        onChange={uploadFile}
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">Files are stored securely in Supabase Storage.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar meta */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Status</p>
              <TicketStatusBadge status={ticket.status} />
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Priority</p>
              <Badge variant={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
            </div>

            {ticket.sla_breached && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-xs font-semibold text-red-600">SLA Breached</p>
              </div>
            )}

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
              <p className="text-sm text-cyan-600">{ticket.contact_email}</p>
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
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Time Logged</p>
              <p className="text-sm font-medium text-gray-700">{formatMinutes(totalMinutes)}</p>
            </div>

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
