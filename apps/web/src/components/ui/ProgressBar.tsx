import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number  // 0–100
  label?: string
  className?: string
}

function getColor(value: number) {
  if (value >= 90) return 'bg-red-500'
  if (value >= 70) return 'bg-yellow-500'
  return 'bg-violet-500'
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{label}</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all', getColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
