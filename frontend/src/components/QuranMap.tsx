import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'

const HIZB_COUNT = 60
const PARTS_PER_HIZB = 8

type PartState = 'done' | 'current' | 'todo'

const SEGMENT_STYLES: Record<PartState, string> = {
  done: 'bg-primary',
  current: 'bg-accent',
  todo: 'bg-muted-foreground/25',
}

/** 60 hizb tiles, each split into 8 parts. `currentIndex` is the part being memorized (481 = finished). */
export function QuranMap({ currentIndex }: { currentIndex: number }) {
  const { t } = useTranslation()

  return (
    <div>
      <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10" aria-label={t('map.title')}>
        {Array.from({ length: HIZB_COUNT }, (_, h) => {
          const hizb = h + 1
          const firstIndex = h * PARTS_PER_HIZB + 1
          const states = Array.from({ length: PARTS_PER_HIZB }, (_, p): PartState => {
            const index = firstIndex + p
            if (index < currentIndex) return 'done'
            return index === currentIndex ? 'current' : 'todo'
          })
          const done = states.filter((s) => s === 'done').length
          const isCurrent = states.includes('current')

          return (
            <li
              key={hizb}
              aria-label={t('map.tile', { hizb, done })}
              title={t('map.tile', { hizb, done })}
              className={cn(
                'rounded-lg border border-border bg-card p-1.5',
                isCurrent && 'border-accent ring-2 ring-accent/40',
              )}
            >
              <p className="mb-1 text-center text-xs font-medium tabular-nums text-muted-foreground">{hizb}</p>
              <div className="flex gap-0.5" aria-hidden="true">
                {states.map((state, i) => (
                  <span key={i} className={cn('h-2 flex-1 rounded-full', SEGMENT_STYLES[state])} />
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {(['done', 'current', 'todo'] as const).map((state) => (
          <li key={state} className="flex items-center gap-2">
            <span className={cn('h-2 w-4 rounded-full', SEGMENT_STYLES[state])} aria-hidden="true" />
            {t(`map.${state}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
