import { cn } from '@/lib/utils'
import type { TicketStatus, ContractStatus, DeviceStatus, CheckStatus, ContractType } from '@operate1/types'

interface BadgeProps {
  className?: string
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gray'
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-cyan-100 text-cyan-700',
  gray: 'bg-gray-100 text-gray-500',
}

export function Badge({ className, children, variant = 'default' }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variantClasses[variant], className)}>
      {children}
    </span>
  )
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const map: Record<TicketStatus, { label: string; variant: BadgeProps['variant'] }> = {
    pending: { label: 'Pending', variant: 'warning' },
    open: { label: 'Open', variant: 'info' },
    in_progress: { label: 'In Progress', variant: 'purple' },
    resolved: { label: 'Resolved', variant: 'success' },
    closed: { label: 'Closed', variant: 'gray' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, { label: string; variant: BadgeProps['variant'] }> = {
    draft: { label: 'Draft', variant: 'gray' },
    active: { label: 'Active', variant: 'success' },
    expired: { label: 'Expired', variant: 'danger' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'default' }
  return <Badge variant={variant}>{label}</Badge>
}

export function ContractTypeBadge({ type }: { type: ContractType }) {
  const map: Record<ContractType, string> = {
    custom: 'Custom',
    standard: 'Standard',
    hourly: 'Hourly',
  }
  return <Badge variant="purple">{map[type] ?? type}</Badge>
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return status === 'online'
    ? <Badge variant="success">Online</Badge>
    : <Badge variant="gray">Offline</Badge>
}

export function MonitorStatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'up') return <Badge variant="success">Up</Badge>
  if (status === 'down') return <Badge variant="danger">Down</Badge>
  return <Badge variant="gray">Unknown</Badge>
}

export function RoleBadge({ role }: { role: string }) {
  return role === 'admin'
    ? <Badge variant="purple">Admin</Badge>
    : <Badge variant="info">User</Badge>
}

export function ActiveBadge({ status }: { status: string }) {
  return status === 'active'
    ? <Badge variant="success">Active</Badge>
    : <Badge variant="gray">Inactive</Badge>
}
