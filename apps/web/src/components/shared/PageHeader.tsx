interface PageHeaderProps {
  title: string
  count?: number
  countLabel?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, count, countLabel = 'found', actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {count !== undefined && (
          <p className="text-sm text-gray-500 mt-0.5">{count} {countLabel}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
