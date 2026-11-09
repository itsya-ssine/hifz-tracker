import { cn } from '../lib/utils'

export function ProgressBar({ percent, label, className }: { percent: number; label: string; className?: string }) {
  const clamped = Math.min(Math.max(percent, 0), 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${clamped}%` }} />
    </div>
  )
}
