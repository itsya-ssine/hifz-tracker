import type { AdminSession } from '../../../api/admin'

export type SessionState = 'cancelled' | 'upcoming' | 'today' | 'past'

export function sessionState(session: AdminSession, todayIso = new Date().toISOString().slice(0, 10)): SessionState {
  if (session.is_cancelled) return 'cancelled'
  if (session.session_date > todayIso) return 'upcoming'
  return session.session_date === todayIso ? 'today' : 'past'
}

/** The session an admin most likely needs next: today's, else the latest past one still unmarked, else the next upcoming. */
export function pickFocusSession(sessions: AdminSession[]): AdminSession | null {
  const open = sessions.filter((s) => !s.is_cancelled)
  const today = open.find((s) => sessionState(s) === 'today')
  if (today) return today
  const pastUnmarked = open.find((s) => sessionState(s) === 'past' && s.counts.marked === 0)
  if (pastUnmarked) return pastUnmarked
  const upcoming = open.filter((s) => sessionState(s) === 'upcoming').sort((a, b) => a.session_date.localeCompare(b.session_date))
  return upcoming[0] ?? null
}
