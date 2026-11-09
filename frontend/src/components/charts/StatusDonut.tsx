import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { ATTENDANCE_STATUSES, type AttendanceStatus, type Overview } from '../../api/student'
import { formatNumber } from '../../lib/format'

const COLORS: Record<AttendanceStatus, string> = {
  PASSED: 'var(--color-success)',
  NOT_PASSED: 'var(--color-warning)',
  ABSENT: 'var(--color-destructive)',
  ABSENT_EXCUSED: 'var(--color-info)',
}

const COUNT_KEY: Record<AttendanceStatus, keyof Overview['stats']> = {
  PASSED: 'passed',
  NOT_PASSED: 'not_passed',
  ABSENT: 'absent',
  ABSENT_EXCUSED: 'absent_excused',
}

export function StatusDonut({ stats }: { stats: Overview['stats'] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const rows = ATTENDANCE_STATUSES.map((status) => ({
    status,
    value: stats[COUNT_KEY[status]] as number,
  }))

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
      <div className="size-44" role="img" aria-label={t('charts.statusTitle')}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="status"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell key={row.status} style={{ fill: COLORS[row.status] }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: COLORS[row.status] }} aria-hidden="true" />
            <span className="text-muted-foreground">{t(`status.${row.status}`)}</span>
            <span className="ms-auto ps-4 font-medium tabular-nums">{formatNumber(row.value, lang, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
