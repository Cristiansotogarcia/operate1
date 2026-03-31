// Shared domain types for Operate1
// Regenerate database.types.ts with: pnpm gen-types

export type Role = 'admin' | 'user'
export type Status = 'active' | 'inactive'
export type TicketStatus = 'pending' | 'open' | 'in_progress' | 'resolved' | 'closed'
export type ContractType = 'custom' | 'standard' | 'hourly'
export type ContractStatus = 'draft' | 'active' | 'expired' | 'cancelled'
export type MonitorType = 'http' | 'icmp' | 'tcp'
export type MonitorStatus = 'active' | 'paused'
export type CheckStatus = 'up' | 'down' | 'unknown'
export type DeviceStatus = 'online' | 'offline'
export type ArticleType = 'internal' | 'public'
export type ArticleStatus = 'draft' | 'published'

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
