import { useEffect, useState, useCallback } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { PageLoader } from '@/components/ui/Spinner'
import { Pencil, Trash2, Paperclip, Upload, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import type { KbArticle, KbCategory, Company, KbAttachment } from '@operate1/types'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

export function KnowledgePage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [articles, setArticles] = useState<KbArticle[]>([])
  const [categories, setCategories] = useState<KbCategory[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KbArticle | null>(null)
  const [form, setForm] = useState({ title: '', body: '', type: 'internal', status: 'draft', category_id: '', company_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attachmentMap, setAttachmentMap] = useState<Record<string, KbAttachment[]>>({})
  const [attUploading, setAttUploading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: a }, { data: cat }, { data: co }] = await Promise.all([
      supabase.from('kb_articles').select('*, category:kb_categories(name), company:companies(name)').order('created_at', { ascending: false }),
      supabase.from('kb_categories').select('*').order('name'),
      supabase.from('companies').select('id, name').order('name'),
    ])
    setArticles((a as KbArticle[]) || [])
    setCategories((cat as KbCategory[]) || [])
    setCompanies((co as Company[]) || [])
    setLoading(false)
  }

  function openCreate() { setEditing(null); setForm({ title: '', body: '', type: 'internal', status: 'draft', category_id: '', company_id: '' }); setModalOpen(true) }
  function openEdit(a: KbArticle) { setEditing(a); setForm({ title: a.title, body: a.body || '', type: a.type, status: a.status, category_id: a.category_id || '', company_id: a.company_id || '' }); setModalOpen(true) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = { title: form.title, body: form.body || null, type: form.type, status: form.status, category_id: form.category_id || null, company_id: form.company_id || null, author_id: profile?.id }
    if (editing) {
      const { error } = await supabase.from('kb_articles').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Article updated')
    } else {
      const { error } = await supabase.from('kb_articles').insert({ ...payload, tenant_id: TENANT_ID })
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Article created')
    }
    setSaving(false); setModalOpen(false); fetchAll()
  }

  const fetchAttachments = useCallback(async (articleId: string) => {
    if (attachmentMap[articleId]) return
    const { data } = await supabase.from('kb_attachments').select('*').eq('article_id', articleId).order('created_at', { ascending: false })
    setAttachmentMap(prev => ({ ...prev, [articleId]: (data ?? []) as KbAttachment[] }))
  }, [attachmentMap])

  function toggleAttachments(articleId: string) {
    if (expandedId === articleId) { setExpandedId(null); return }
    setExpandedId(articleId)
    fetchAttachments(articleId)
  }

  async function uploadKbFile(articleId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) { toast.error('File too large — maximum 5 MB'); e.target.value = ''; return }
    setAttUploading(true)
    const path = `${TENANT_ID}/${articleId}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('kb-attachments').upload(path, file)
    if (upErr) { toast.error('Upload failed: ' + upErr.message); setAttUploading(false); return }
    await supabase.from('kb_attachments').insert({
      tenant_id: TENANT_ID,
      article_id: articleId,
      uploaded_by: profile?.id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: path,
    })
    setAttUploading(false)
    e.target.value = ''
    toast.success('File uploaded')
    // Invalidate cache for this article
    setAttachmentMap(prev => { const n = { ...prev }; delete n[articleId]; return n })
    fetchAttachments(articleId)
  }

  async function downloadKbFile(att: KbAttachment) {
    const { data } = await supabase.storage.from('kb-attachments').createSignedUrl(att.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteKbAttachment(att: KbAttachment) {
    await supabase.storage.from('kb-attachments').remove([att.storage_path])
    await supabase.from('kb_attachments').delete().eq('id', att.id)
    setAttachmentMap(prev => ({ ...prev, [att.article_id]: (prev[att.article_id] ?? []).filter(a => a.id !== att.id) }))
    toast.success('Attachment deleted')
  }

  function formatBytes(b: number | null) {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1048576).toFixed(1)} MB`
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase.from('kb_articles').delete().eq('id', deleteTarget)
    setDeleteTarget(null)
    if (error) { toast.error(error.message); return }
    toast.success('Article deleted'); fetchAll()
  }

  let filtered = articles
  if (search) filtered = filtered.filter(a => [a.title, a.body].some(f => f?.toLowerCase().includes(search.toLowerCase())))
  if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter)
  if (statusFilter) filtered = filtered.filter(a => a.status === statusFilter)
  if (categoryFilter) filtered = filtered.filter(a => a.category_id === categoryFilter)

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader title="Knowledge Base" count={filtered.length} countLabel="article(s) found"
        actions={isAdmin && <Button size="sm" onClick={openCreate}>New Article</Button>} />

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Search & Filters</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <input placeholder="Search by title, content..." value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-2 md:col-span-1 focus:outline-none focus:ring-1 focus:ring-violet-500" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Types</option><option value="internal">Internal</option><option value="public">Public</option></select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Statuses</option><option value="draft">Draft</option><option value="published">Published</option></select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
            <option value="">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setCategoryFilter('') }}
            className="text-sm text-gray-500 border border-gray-300 rounded-md px-3 py-2">Clear Filters</button>
        </div>
      </div>

      {filtered.length === 0 ? <EmptyState title="No articles found" description="Create your first article to get started" /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Title</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Files</th>
              {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(a => (
                <>
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.title}</td>
                    <td className="px-4 py-3"><Badge variant={a.type === 'public' ? 'info' : 'default'}>{a.type}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={a.status === 'published' ? 'success' : 'gray'}>{a.status}</Badge></td>
                    <td className="px-4 py-3 text-gray-600">{(a.category as any)?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{(a.company as any)?.name || 'Shared'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAttachments(a.id)} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700">
                        <Paperclip size={13} />
                        {expandedId === a.id ? 'Hide' : 'Files'}
                      </button>
                    </td>
                    {isAdmin && <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(a)} className="p-1 text-gray-400 hover:text-amber-600"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteTarget(a.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div></td>}
                  </tr>
                  {expandedId === a.id && (
                    <tr key={`${a.id}-att`}>
                      <td colSpan={isAdmin ? 7 : 6} className="bg-gray-50 px-6 py-3 border-b border-gray-100">
                        <div className="space-y-1">
                          {(attachmentMap[a.id] ?? []).map(att => (
                            <div key={att.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                              <div className="flex items-center gap-2 text-gray-700">
                                <Paperclip size={12} className="text-gray-400" />
                                <span>{att.file_name}</span>
                                <span className="text-gray-400">{formatBytes(att.file_size)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => downloadKbFile(att)} className="text-gray-400 hover:text-violet-600"><Download size={13} /></button>
                                {isAdmin && <button onClick={() => deleteKbAttachment(att)} className="text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>}
                              </div>
                            </div>
                          ))}
                          {(attachmentMap[a.id] ?? []).length === 0 && (
                            <p className="text-xs text-gray-400 py-1">No files attached.</p>
                          )}
                          {isAdmin && (
                            <label className="mt-2 flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 cursor-pointer font-medium">
                              <Upload size={12} />{attUploading ? 'Uploading…' : 'Attach file (max 5 MB)'}
                              <input type="file" className="hidden" disabled={attUploading} onChange={e => uploadKbFile(a.id, e)} />
                            </label>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Article' : 'New Article'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea rows={8} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="internal">Internal</option><option value="public">Public</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="draft">Draft</option><option value="published">Published</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">None</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white">
                <option value="">All Companies (Shared)</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Article" message="Are you sure?" />
    </div>
  )
}
