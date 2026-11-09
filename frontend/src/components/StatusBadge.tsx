import { useTranslation } from 'react-i18next'
import type { AttendanceStatus } from '../api/student'
import { cn } from '../lib/utils'
import { STATUS_ICONS, STATUS_TONES } from './status-meta'

export function StatusBadge({
  status,
  count,
  className,
}: {
  status: AttendanceStatus
  count?: number
  className?: string
}) {
  const { t } = useTranslation()
  const Icon = STATUS_ICONS[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        STATUS_TONES[status],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(`status.${status}`)}
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </span>
  )
}
