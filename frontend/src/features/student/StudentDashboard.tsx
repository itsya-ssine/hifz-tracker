import { Sprout } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { QuranMap } from '../../components/QuranMap'
import { Skeleton } from '../../components/Skeleton'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { useAuth } from '../auth/auth-context'
import { OverviewHero, OverviewStats } from '../progress/OverviewSections'
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
          <OverviewHero overview={overview} subject="self" />
          <OverviewStats overview={overview} />

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
