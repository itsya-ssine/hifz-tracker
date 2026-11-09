import { useTranslation } from 'react-i18next'
import type { AdminSession } from '../../../api/admin'
import { cn } from '../../../lib/utils'
import { sessionState, type SessionState } from './session-state'

const TONES: Record<SessionState, string> = {
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
  upcoming: 'bg-info/10 text-info border-info/30',
  today: 'bg-accent/15 text-accent border-accent/40',
  past: 'bg-muted text-muted-foreground border-border',
}

export function SessionStateBadge({ session }: { session: AdminSession }) {
  const { t } = useTranslation()
  const state = sessionState(session)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium',
        TONES[state],
      )}
    >
      {t(`sessions.state.${state}`)}
    </span>
  )
}
