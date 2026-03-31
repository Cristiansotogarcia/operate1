// Public Ticket Submission Portal
// No authentication required — accessible at /#/portal
// Clients can submit tickets directly without logging in.

import { useEffect, useState } from 'react'
import { supabase, TENANT_ID } from '@/lib/supabase'
import { CheckCircle, AlertCircle } from 'lucide-react'
import type { Company, Site, TicketType } from '@operate1/types'
import { z } from 'zod'

const portalSchema = z.object({
  contact_email: z.string().email('Please enter a valid email address'),
  contact_name: z.string().min(1, 'Name is required'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
})

type FormState = {
  contact_email: string
  contact_name: string
  company_id: string
  site_id: string
  ticket_type_id: string
  subject: string
  description: string
}

export function PublicPortalPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [filteredSites, setFilteredSites] = useState<Site[]>([])
  const [form, setForm] = useState<FormState>({
    contact_email: '', contact_name: '', company_id: '',
    site_id: '', ticket_type_id: '', subject: '', description: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null) // ticket number on success
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => { fetchPublicData() }, [])

  useEffect(() => {
    if (form.company_id) {
      setFilteredSites(sites.filter(s => s.company_id === form.company_id))
      setForm(f => ({ ...f, site_id: '' }))
    } else {
      setFilteredSites(sites)
    }
  }, [form.company_id, sites])

  async function fetchPublicData() {
    // Fetch only active companies, their sites, and ticket types
    const [{ data: co }, { data: si }, { data: tt }] = await Promise.all([
      supabase.from('companies').select('id,name').eq('status', 'active').order('name'),
      supabase.from('sites').select('id,name,company_id').order('name'),
      supabase.from('ticket_types').select('id,name').order('name'),
    ])
    setCompanies((co ?? []) as Company[])
    setSites((si ?? []) as Site[])
    setFilteredSites((si ?? []) as Site[])
    setTicketTypes((tt ?? []) as TicketType[])
  }

  function set(field: keyof FormState, val: string) {
    setForm(f => ({ ...f, [field]: val }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const parsed = portalSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormState, string>> = {}
      parsed.error.errors.forEach(err => {
        const field = err.path[0] as keyof FormState
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      // Generate ticket number via RPC
      const { data: ticketNum } = await supabase.rpc('generate_ticket_number', { p_tenant_id: TENANT_ID })

      const { error } = await supabase.from('tickets').insert({
        tenant_id: TENANT_ID,
        ticket_number: ticketNum ?? `T-${Date.now()}`,
        contact_email: form.contact_email.trim().toLowerCase(),
        contact_name: form.contact_name.trim(),
        company_id: form.company_id || null,
        site_id: form.site_id || null,
        ticket_type_id: form.ticket_type_id || null,
        subject: form.subject.trim(),
        description: form.description.trim(),
        status: 'pending',
      })

      if (error) throw error
      setSubmitted(ticketNum ?? 'Submitted')
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Ticket Submitted</h1>
          <p className="text-gray-600 mb-4">
            Your support request has been received. Your ticket number is:
          </p>
          <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 mb-6">
            <p className="text-2xl font-bold text-violet-700 font-mono">{submitted}</p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            A member of our team will be in touch at <strong>{form.contact_email}</strong>.
          </p>
          <button
            onClick={() => { setSubmitted(null); setForm({ contact_email: '', contact_name: '', company_id: '', site_id: '', ticket_type_id: '', subject: '', description: '' }) }}
            className="text-sm text-violet-600 hover:underline"
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0f172a] text-white py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold">Operate1</h1>
          <p className="text-slate-400 text-sm mt-0.5">Submit a support request</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">New Support Request</h2>

          {submitError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-4 mb-5 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={e => set('contact_name', e.target.value)}
                  placeholder="John Smith"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors.contact_name ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.contact_name && <p className="text-xs text-red-500 mt-1">{errors.contact_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                  placeholder="you@company.com"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors.contact_email ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.contact_email && <p className="text-xs text-red-500 mt-1">{errors.contact_email}</p>}
              </div>
            </div>

            {/* Company + Site */}
            {companies.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <select value={form.company_id} onChange={e => set('company_id', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="">Select company…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {filteredSites.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Site / Location</label>
                    <select value={form.site_id} onChange={e => set('site_id', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                      <option value="">Select site…</option>
                      {filteredSites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Type */}
            {ticketTypes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                <select value={form.ticket_type_id} onChange={e => set('ticket_type_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="">Select type…</option>
                  {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <input
                type="text"
                value={form.subject}
                onChange={e => set('subject', e.target.value)}
                placeholder="Brief summary of your issue"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors.subject ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                rows={5}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Please describe your issue in detail…"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none ${errors.description ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Operate1 · <a href="/#/status" className="text-violet-500 hover:underline">System Status</a>
        </p>
      </div>
    </div>
  )
}
