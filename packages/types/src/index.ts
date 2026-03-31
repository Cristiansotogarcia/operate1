// Shared domain types for Operate1
// Regenerate database.types.ts with: pnpm gen-types

export type Role = 'admin' | 'user'
export type Status = 'active' | 'inactive'
export type TicketStatus = 'pending' | 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'critical'
export type ContractType = 'custom' | 'standard' | 'hourly'
export type ContractStatus = 'draft' | 'active' | 'expired' | 'cancelled'
export type MonitorType = 'http' | 'icmp' | 'tcp'
export type MonitorStatus = 'active' | 'paused'
export type CheckStatus = 'up' | 'down' | 'unknown'
export type DeviceStatus = 'online' | 'offline'
export type ArticleType = 'internal' | 'public'
export type ArticleStatus = 'draft' | 'published'
export type WebhookProvider = 'slack' | 'teams' | 'generic'

export interface Tenant {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  username: string | null
  role: Role
  status: Status
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  tenant_id: string
  name: string
  notes: string | null
  status: Status
  created_at: string
  updated_at: string
}

export interface CostCenter {
  id: string
  tenant_id: string
  code: string
  description: string | null
  created_at: string
}

export interface Site {
  id: string
  tenant_id: string
  company_id: string
  cost_center_id: string | null
  name: string
  address: string | null
  created_at: string
  updated_at: string
  // joined
  company?: Company
  cost_center?: CostCenter
}

export interface Contract {
  id: string
  tenant_id: string
  company_id: string | null
  contract_number: string
  name: string
  type: ContractType
  status: ContractStatus
  starts_at: string | null
  ends_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  company?: Company
}

export interface TicketType {
  id: string
  tenant_id: string
  name: string
  created_at: string
}

export interface Ticket {
  id: string
  tenant_id: string
  ticket_number: string
  company_id: string | null
  site_id: string | null
  ticket_type_id: string | null
  contact_email: string
  contact_name: string | null
  subject: string
  description: string | null
  status: TicketStatus
  priority: TicketPriority
  sla_policy_id: string | null
  first_response_at: string | null
  resolved_at: string | null
  sla_breached: boolean
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joined
  company?: Company
  site?: Site
  ticket_type?: TicketType
  assignee?: Profile
}

export interface KbCategory {
  id: string
  tenant_id: string
  name: string
  created_at: string
}

export interface KbArticle {
  id: string
  tenant_id: string
  title: string
  body: string | null
  type: ArticleType
  status: ArticleStatus
  category_id: string | null
  company_id: string | null
  site_id: string | null
  author_id: string | null
  created_at: string
  updated_at: string
  // joined
  category?: KbCategory
  company?: Company
}

export interface Device {
  id: string
  tenant_id: string
  company_id: string | null
  registration_key: string
  api_secret: string
  name: string
  computer_name: string | null
  os: string | null
  status: DeviceStatus
  last_seen_at: string | null
  last_ip: string | null
  cpu_percent: number | null
  ram_percent: number | null
  disk_percent: number | null
  created_at: string
  updated_at: string
  // joined
  company?: Company
}

export interface DeviceHeartbeat {
  id: string
  device_id: string
  cpu_percent: number | null
  ram_percent: number | null
  disk_percent: number | null
  ip_address: string | null
  recorded_at: string
}

export interface Monitor {
  id: string
  tenant_id: string
  device_id: string | null
  company_id: string | null
  name: string
  type: MonitorType
  target: string
  port: number | null
  interval_seconds: number
  status: MonitorStatus
  last_status: CheckStatus
  last_checked_at: string | null
  uptime_percent: number
  avg_response_ms: number
  failure_count: number
  created_at: string
  updated_at: string
  // joined
  device?: Device
  company?: Company
}

export interface MonitorResult {
  id: string
  monitor_id: string
  status: 'up' | 'down'
  response_ms: number | null
  error_message: string | null
  checked_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  // joined
  actor?: Profile
}

export interface SlaPolicy {
  id: string
  tenant_id: string
  name: string
  ticket_type_id: string | null
  priority: TicketPriority
  response_minutes: number
  resolve_minutes: number
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  ticket_type?: TicketType
}

export interface TimeEntry {
  id: string
  tenant_id: string
  ticket_id: string
  technician_id: string | null
  description: string | null
  minutes: number
  billable: boolean
  logged_at: string
  created_at: string
  // joined
  technician?: Profile
}

export interface TicketAttachment {
  id: string
  tenant_id: string
  ticket_id: string
  comment_id: string | null
  uploaded_by: string | null
  file_name: string
  file_size: number | null
  mime_type: string | null
  storage_path: string
  created_at: string
}

export interface KbAttachment {
  id: string
  tenant_id: string
  article_id: string
  uploaded_by: string | null
  file_name: string
  file_size: number | null
  mime_type: string | null
  storage_path: string
  created_at: string
}

export interface ApiKey {
  id: string
  tenant_id: string
  name: string
  key_hash: string
  key_prefix: string
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_by: string | null
  created_at: string
  revoked_at: string | null
}

export interface EmailRoute {
  id: string
  tenant_id: string
  inbound_address: string
  company_id: string | null
  site_id: string | null
  ticket_type_id: string | null
  default_status: 'pending' | 'open' | 'in_progress'
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  company?: Company
  ticket_type?: TicketType
}

export interface WebhookConfig {
  id: string
  tenant_id: string
  name: string
  url: string
  provider: WebhookProvider
  events: string[]
  is_active: boolean
  secret: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface UserCompanyAccess {
  id: string
  profile_id: string
  company_id: string
  tenant_id: string
  created_at: string
  company?: Company
}

export interface UserSiteAccess {
  id: string
  profile_id: string
  site_id: string
  tenant_id: string
  created_at: string
  site?: Site
}
