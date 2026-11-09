import { CircleCheck, CircleX, RotateCcw, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AttendanceStatus } from '../api/student'
import { cn } from '../lib/utils'

// Never rely on color alone: every status has its own icon and label.
const STYLES: Record<AttendanceStatus, { icon: LucideIcon; className: string }> = {
  PASSED: { icon: CircleCheck, className: 'bg-success/10 text-success border-success/30' },
  NOT_PASSED: { icon: RotateCcw, className: 'bg-warning/10 text-warning border-warning/30' },
  ABSENT: { icon: CircleX, className: 'bg-destructive/10 text-destructive border-destructive/30' },
  ABSENT_EXCUSED: { icon: ShieldCheck, className: 'bg-info/10 text-info border-info/30' },
}

export function StatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  const { t } = useTranslation()
  const { icon: Icon, className: tone } = STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  )
}
