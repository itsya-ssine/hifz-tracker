import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTENDANCE_STATUSES, type AttendanceStatus, type HistoryRecord } from '../../api/student'
import { Pagination } from '../../components/Pagination'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { Button } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Label } from '../../components/ui/label'
import { formatDate } from '../../lib/format'
import { useHistory } from './queries'

const PAGE_SIZE = 10

function notesOf(record: HistoryRecord): string | null {
  return [record.excuse_note, record.admin_note].filter(Boolean).join(' · ') || null
}

export function StudentHistoryPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
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
          {/* Table on larger screens */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-start text-muted-foreground">
                <tr>
                  {(['date', 'session', 'part', 'status', 'notes'] as const).map((column) => (
                    <th key={column} scope="col" className="px-4 py-3 text-start font-medium">
                      {t(`history.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(record.session_date, lang)}</td>
                    <td className="px-4 py-3">{record.title ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {t('quran.position', { hizb: record.hizb, part: record.part })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{notesOf(record) ?? t('history.noNotes')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards on phones */}
          <ul className="space-y-3 md:hidden">
            {data.items.map((record) => (
              <li key={record.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatDate(record.session_date, lang)}</p>
                      {record.title && <p className="text-xs text-muted-foreground">{record.title}</p>}
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <p className="mt-3 text-sm">{t('quran.position', { hizb: record.hizb, part: record.part })}</p>
                  {notesOf(record) && <p className="mt-1 text-sm text-muted-foreground">{notesOf(record)}</p>}
                </Card>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} disabled={query.isFetching} />
        </>
      )}
    </div>
  )
}
