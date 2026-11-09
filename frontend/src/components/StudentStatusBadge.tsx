import { useTranslation } from 'react-i18next'
import type { StudentStatus } from '../api/student'
import { cn } from '../lib/utils'

const TONES: Record<StudentStatus, string> = {
  ACTIVE: 'bg-success/10 text-success border-success/30',
  PAUSED: 'bg-warning/10 text-warning border-warning/30',
  COMPLETED: 'bg-accent/15 text-accent border-accent/40',
  LEFT: 'bg-muted text-muted-foreground border-border',
}

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        TONES[status],
      )}
    >
      {t(`studentStatus.${status}`)}
    </span>
  )
}
