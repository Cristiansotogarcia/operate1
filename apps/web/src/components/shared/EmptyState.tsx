interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* Mailbox illustration */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-4 opacity-60">
        <rect x="10" y="30" width="60" height="35" rx="4" fill="#e2e8f0" />
        <rect x="20" y="24" width="40" height="20" rx="4" fill="#cbd5e1" />
        <rect x="30" y="18" width="20" height="10" rx="2" fill="#94a3b8" />
        <path d="M10 42 L40 56 L70 42" stroke="#94a3b8" strokeWidth="2" fill="none" />
        <circle cx="60" cy="28" r="8" fill="#f59e0b" />
        <path d="M56 28 L59 31 L65 25" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-gray-700 font-medium text-base">{title}</p>
      {description && <p className="text-sm text-cyan-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
