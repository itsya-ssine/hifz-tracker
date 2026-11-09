import { CalendarDays, Flame, Percent, Trophy, CircleCheck, Sprout } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Overview } from '../../api/student'
import { ProgressRing } from '../../components/ProgressRing'
import { QuranMap } from '../../components/QuranMap'
import { Skeleton } from '../../components/Skeleton'
import { StatCard } from '../../components/StatCard'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { formatDate, formatNumber, formatPercent } from '../../lib/format'
import { useAuth } from '../auth/auth-context'
import { useOverview, useTimeline } from './queries'

// The charts library is large: load it only when the dashboard actually shows charts.
const ProgressChart = lazy(() =>
  import('../../components/charts/ProgressChart').then((m) => ({ default: m.ProgressChart })),
)
const StatusDonut = lazy(() =>
  import('../../components/charts/StatusDonut').then((m) => ({ default: m.StatusDonut })),
)

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      <Skeleton className="h-52 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function Hero({ overview }: { overview: Overview }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { position, progress, completed } = overview

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <ProgressRing percent={progress.percent} />
        <div className="text-center sm:text-start">
          {completed ? (
            <>
              <Trophy className="mx-auto size-8 text-accent sm:mx-0" aria-hidden="true" />
              <h2 className="mt-2 text-2xl font-semibold">{t('student.completedTitle')}</h2>
              <p className="mt-1 text-muted-foreground">{t('student.completedBody')}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('student.currentLabel')}</p>
              <h2 className="mt-1 text-3xl font-semibold">
                {position && t('quran.position', { hizb: position.hizb, part: position.part })}
              </h2>
            </>
          )}
          <p className="mt-3 text-muted-foreground">
            {t('student.partsProgress', {
              done: formatNumber(progress.completed_parts, lang, 0),
              total: formatNumber(progress.total_parts, lang, 0),
            })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('student.gained', { count: formatNumber(progress.parts_gained, lang, 0) })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function Stats({ overview }: { overview: Overview }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { stats, next_session: next } = overview

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Percent}
        label={t('stats.attendanceRate')}
        value={formatPercent(stats.attendance_rate, lang)}
        hint={t('stats.attendanceHint', { rate: formatPercent(stats.adjusted_attendance_rate, lang) })}
      />
      <StatCard
        icon={CircleCheck}
        label={t('stats.passedSessions')}
        value={formatNumber(stats.passed, lang, 0)}
        hint={t('stats.passedHint', {
          passed: formatNumber(stats.passed, lang, 0),
          total: formatNumber(stats.total_sessions, lang, 0),
        })}
      />
      <StatCard
        icon={Flame}
        label={t('stats.streak')}
        value={formatNumber(stats.current_streak, lang, 0)}
        hint={t('stats.streakHint')}
      />
      <StatCard
        icon={CalendarDays}
        label={t('stats.nextSession')}
        value={next ? formatDate(next.session_date, lang) : '—'}
        hint={next ? (next.title ?? undefined) : t('stats.noNextSession')}
      />
    </div>
  )
}

export function StudentDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const overviewQuery = useOverview()
  const timelineQuery = useTimeline()
  const overview = overviewQuery.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('student.welcome', { name: user?.full_name })}</h1>
          <p className="text-muted-foreground">{t('student.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/student/history">{t('student.viewHistory')}</Link>
        </Button>
      </div>

      {overviewQuery.isPending && <DashboardSkeleton />}

      {overviewQuery.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('student.loadFailed')}
            </p>
            <Button variant="outline" onClick={() => void overviewQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {overview && (
        <>
          <Hero overview={overview} />
          <Stats overview={overview} />

          {overview.stats.total_sessions === 0 && (
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-accent">
                  <Sprout className="size-6" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">{t('student.emptyTitle')}</h2>
                  <p className="text-sm text-muted-foreground">{t('student.emptyBody')}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('map.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <QuranMap currentIndex={overview.student.current_index} />
            </CardContent>
          </Card>

          {overview.stats.total_sessions > 0 && (
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>{t('charts.progressTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {timelineQuery.data ? (
                    <Suspense fallback={<Skeleton className="h-60 w-full" />}>
                      <ProgressChart timeline={timelineQuery.data} />
                    </Suspense>
                  ) : (
                    <Skeleton className="h-60 w-full" />
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t('charts.statusTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<Skeleton className="h-44 w-full" />}>
                    <StatusDonut stats={overview.stats} />
                  </Suspense>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
