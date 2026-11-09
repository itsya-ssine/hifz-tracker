import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../../api/student'
import { Pagination } from '../../components/Pagination'
import { Skeleton } from '../../components/Skeleton'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Label } from '../../components/ui/label'
import { HistoryList } from '../progress/HistoryList'
import { useHistory } from './queries'

const PAGE_SIZE = 10

export function StudentHistoryPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<AttendanceStatus | ''>('')
  const query = useHistory(page, PAGE_SIZE, status || undefined)

  const data = query.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('history.title')}</h1>
          <p className="text-muted-foreground">{t('history.subtitle')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status-filter">{t('history.filter')}</Label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AttendanceStatus | '')
              setPage(1)
            }}
            className="flex h-10 w-48 rounded-lg border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('status.all')}</option>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {query.isPending && <Skeleton className="h-72 w-full" />}

      {query.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('history.loadFailed')}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {status ? t('history.emptyFiltered') : t('history.empty')}
          </CardContent>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <HistoryList records={data.items} />

          <Pagination page={page} pageCount={pageCount} onChange={setPage} disabled={query.isFetching} />
        </>
      )}
    </div>
  )
}
