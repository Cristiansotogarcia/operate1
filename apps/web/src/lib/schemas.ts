import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const newTicketSchema = z.object({
  contact_email: z.string().email('Enter a valid email address'),
  contact_name: z.string().optional(),
  company_id: z.string().optional(),
  site_id: z.string().optional(),
  ticket_type_id: z.string().optional(),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  description: z.string().optional(),
  status: z.enum(['pending', 'open', 'in_progress', 'resolved', 'closed']),
})

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
})

export const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  company_id: z.string().min(1, 'Company is required'),
  cost_center_id: z.string().optional(),
  address: z.string().optional(),
})

export const contractSchema = z.object({
  name: z.string().min(1, 'Contract name is required'),
  contract_number: z.string().min(1, 'Contract number is required'),
  company_id: z.string().optional(),
  type: z.enum(['custom', 'standard', 'hourly']),
  status: z.enum(['draft', 'active', 'expired', 'cancelled']),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  notes: z.string().optional(),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

export type LoginInput = z.infer<typeof loginSchema>
export type NewTicketInput = z.infer<typeof newTicketSchema>
