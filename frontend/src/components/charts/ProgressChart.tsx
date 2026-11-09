import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Timeline } from '../../api/student'
import { formatDate, formatNumber } from '../../lib/format'

/** Parts memorized after each session. The chart itself is always drawn left-to-right (time axis). */
export function ProgressChart({ timeline }: { timeline: Timeline }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const data = timeline.points.map((p) => ({
    date: p.session_date,
    parts: Math.min(p.current_index - 1, 480),
  }))

  return (
    <div dir="ltr" className="h-60 w-full" role="img" aria-label={t('charts.progressTitle')}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} style={{ stroke: 'var(--color-border)' }} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDate(value, lang, { day: 'numeric', month: 'short' })}
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            domain={['dataMin - 1', 'dataMax + 1']}
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
            tickFormatter={(value: number) => formatNumber(Math.max(value, 0), lang, 0)}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            labelFormatter={(value) => formatDate(String(value), lang)}
            formatter={(value) => [formatNumber(Number(value), lang, 0), t('charts.progressSeries')]}
            contentStyle={{
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              color: 'var(--color-card-foreground)',
            }}
          />
          <Area
            type="monotone"
            dataKey="parts"
            strokeWidth={2.5}
            style={{ stroke: 'var(--color-primary)', fill: 'var(--color-primary)' }}
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
