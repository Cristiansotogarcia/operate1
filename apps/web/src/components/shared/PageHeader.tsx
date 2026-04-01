interface PageHeaderProps {
  title: string
  subtitle?: string
  count?: number
  countLabel?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, count, countLabel = 'found', actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        {count !== undefined && (
          <p className="text-sm text-gray-500 mt-0.5">{count} {countLabel}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 shrink-0">{actions}</div>}
    </div>
  )
}
