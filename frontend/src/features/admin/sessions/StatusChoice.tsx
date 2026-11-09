import { useTranslation } from 'react-i18next'
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../../../api/student'
import { STATUS_ICONS, STATUS_TONES } from '../../../components/status-meta'
import { cn } from '../../../lib/utils'

interface StatusChoiceProps {
  /** Unique per student so each group is its own native radio group (arrow keys work). */
  name: string
  legend: string
  value: AttendanceStatus | null
  onChange: (status: AttendanceStatus) => void
  disabled?: boolean
}

export function StatusChoice({ name, legend, value, onChange, disabled }: StatusChoiceProps) {
  const { t } = useTranslation()
  return (
    <fieldset className="grid grid-cols-2 gap-2 md:flex" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      {ATTENDANCE_STATUSES.map((status) => {
        const Icon = STATUS_ICONS[status]
        const checked = value === status
        return (
          <label
            key={status}
            className={cn(
              'flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
              checked ? `${STATUS_TONES[status]} font-medium` : 'border-border hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={status}
              checked={checked}
              onChange={() => onChange(status)}
            />
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{t(`status.${status}`)}</span>
          </label>
        )
      })}
    </fieldset>
  )
}
