import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { TENANT_ID } from '@/lib/supabase'
import { newTicketSchema } from '@/lib/schemas'
import { FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Company, Site, TicketType, TicketTemplate } from '@operate1/types'

export function NewTicketPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [templates, setTemplates] = useState<TicketTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    contact_email: '',
    contact_name: '',
    company_id: '',
    site_id: '',
    ticket_type_id: '',
    subject: '',
    description: '',
    status: 'pending',
  })

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (form.company_id) fetchSites(form.company_id) }, [form.company_id])

  async function fetchData() {
    const [{ data: co }, { data: tt }, { data: tpl }] = await Promise.all([
      supabase.from('companies').select('*').eq('status', 'active').order('name'),
      supabase.from('ticket_types').select('*').order('name'),
      supabase.from('ticket_templates').select('*').eq('is_active', true).order('name'),
    ])
    setCompanies(co || [])
    setTicketTypes(tt || [])
    setTemplates((tpl as TicketTemplate[]) || [])
  }

  async function fetchSites(companyId: string) {
    const { data } = await supabase.from('sites').select('*').eq('company_id', companyId).order('name')
    setSites(data || [])
    setForm(f => ({ ...f, site_id: '' }))
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find(t => t.id === templateId)
    if (!tpl) return
    setForm(f => ({
      ...f,
      subject: tpl.subject || f.subject,
      description: tpl.description || f.description,
      ticket_type_id: tpl.ticket_type_id || f.ticket_type_id,
      company_id: tpl.company_id || f.company_id,
    }))
    toast.success(`Template "${tpl.name}" applied`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = newTicketSchema.safeParse({ ...form, status: form.status as any })
    if (!result.success) { toast.error(result.error.errors[0].message); return }
    setLoading(true)
    const { error } = await supabase.from('tickets').insert({
      tenant_id: TENANT_ID,
      contact_email: form.contact_email,
      contact_name: form.contact_name || null,
      company_id: form.company_id || null,
      site_id: form.site_id || null,
      ticket_type_id: form.ticket_type_id || null,
      subject: form.subject,
      description: form.description || null,
      status: form.status,
      created_by: profile?.id,
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ticket registered successfully')
    navigate('/tickets')
  }

  const isAdmin = profile?.role === 'admin'

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Register New Ticket</h2>

      {/* Template selector */}
      {templates.length > 0 && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-cyan-600" />
            <label className="text-sm font-medium text-cyan-700">Apply Template</label>
          </div>
          <select
            onChange={e => { if (e.target.value) applyTemplate(e.target.value); e.target.value = '' }}
            className="w-full border border-cyan-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">Select a template to pre-fill fields...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Email <span className="text-red-500">*</span></label>
          <input required type="email" placeholder="example@email.com" value={form.contact_email} onChange={e => set('contact_email', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Contact Name</label>
          <input type="text" placeholder="Full name" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Company <span className="text-red-500">*</span></label>
          <select required value={form.company_id} onChange={e => set('company_id', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500">
            <option value="">Select a company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Site <span className="text-red-500">*</span></label>
          <select required value={form.site_id} onChange={e => set('site_id', e.target.value)}
            disabled={!form.company_id}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:bg-gray-50">
            <option value="">{form.company_id ? 'Select a site' : 'First select a company'}</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Ticket Type <span className="text-red-500">*</span></label>
        <select required value={form.ticket_type_id} onChange={e => set('ticket_type_id', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500">
          <option value="">Select a type</option>
          {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Subject <span className="text-red-500">*</span></label>
        <input required type="text" placeholder="Brief summary of the issue" value={form.subject} onChange={e => set('subject', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Description <span className="text-red-500">*</span></label>
        <textarea
          required rows={5} placeholder="Describe the problem or request in detail..."
          value={form.description} onChange={e => set('description', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      {isAdmin && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Status <span className="text-red-500">*</span></label>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500">
            <option value="pending">Pending</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} className="flex-1">Register Ticket</Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/tickets')} className="flex-1">Cancel</Button>
      </div>
    </form>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        {formContent}
      </div>
    </div>
  )
}
