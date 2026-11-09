import { CalendarCheck, GraduationCap, Plus, Trophy, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ATTENDANCE_STATUSES } from '../../api/student'
import { Skeleton } from '../../components/Skeleton'
import { StatCard } from '../../components/StatCard'
import { StatusBadge } from '../../components/StatusBadge'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { formatDate, formatNumber } from '../../lib/format'
import { useAuth } from '../auth/auth-context'
import { useSessions, useStudents } from './queries'
import { CreateSessionDialog } from './sessions/CreateSessionDialog'
import { pickFocusSession, sessionState } from './sessions/session-state'
import { SessionStateBadge } from './sessions/SessionStateBadge'

const COUNT_KEY = {
  PASSED: 'passed',
  NOT_PASSED: 'not_passed',
  ABSENT: 'absent',
  ABSENT_EXCUSED: 'absent_excused',
} as const

function useCount(status?: 'ACTIVE' | 'COMPLETED') {
  const query = useStudents({ status, page: 1, pageSize: 1 })
  return query
}

export function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { user } = useAuth()
  const [creating, setCreating] = useState(false)

  const all = useCount()
  const active = useCount('ACTIVE')
  const completed = useCount('COMPLETED')
  const sessions = useSessions(1, 10)

  const recent = sessions.data?.items.slice(0, 5) ?? []
  const focus = sessions.data ? pickFocusSession(sessions.data.items) : null
  const value = (q: { data?: { total: number } }) => (q.data ? formatNumber(q.data.total, lang, 0) : '—')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.welcome', { name: user?.full_name })}</h1>
          <p className="text-muted-foreground">{t('admin.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/students">
              <Users className="size-4" aria-hidden="true" />
              {t('admin.manageStudents')}
            </Link>
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t('sessions.add')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label={t('admin.stats.students')} value={value(all)} />
        <StatCard icon={GraduationCap} label={t('admin.stats.active')} value={value(active)} />
        <StatCard icon={Trophy} label={t('admin.stats.completed')} value={value(completed)} />
      </div>

      {sessions.isPending && <Skeleton className="h-32 w-full" />}

      {sessions.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('sessions.loadFailed')}
            </p>
            <Button variant="outline" onClick={() => void sessions.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {sessions.data && (
        <>
          {focus ? (
            <Card className="border-accent/50">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="flex items-center gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-accent">
                    <CalendarCheck className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {sessionState(focus) === 'upcoming' ? t('admin.nextSession') : t('admin.needsAttendance')}
                    </p>
                    <p className="text-lg font-semibold">
                      {formatDate(focus.session_date, lang)}
                      {focus.title ? ` · ${focus.title}` : ''}
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link to={`/admin/sessions/${focus.id}`}>{t('admin.openSheet')}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-muted-foreground">{t('admin.noSessionToTake')}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('admin.recentSessions')}</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/sessions">{t('admin.viewAll')}</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('sessions.empty')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((session) => (
                    <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <Link
                          to={`/admin/sessions/${session.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {formatDate(session.session_date, lang)}
                        </Link>
                        {session.title && <span className="text-sm text-muted-foreground">{session.title}</span>}
                        <SessionStateBadge session={session} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ATTENDANCE_STATUSES.map((status) => {
                          const count = session.counts[COUNT_KEY[status]]
                          return count > 0 ? <StatusBadge key={status} status={status} count={count} /> : null
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <CreateSessionDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
