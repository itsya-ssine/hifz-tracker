import { useTranslation } from 'react-i18next'
import { formatNumber } from '../lib/format'

interface ProgressRingProps {
  percent: number // 0..100
  size?: number
  strokeWidth?: number
}

export function ProgressRing({ percent, size = 168, strokeWidth = 14 }: ProgressRingProps) {
  const { i18n } = useTranslation()
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(percent, 0), 100)
  const label = `${formatNumber(clamped, i18n.resolvedLanguage ?? 'en')}%`

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          style={{ stroke: 'var(--color-muted)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ stroke: 'var(--color-primary)', transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-semibold" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}
