import { ClipboardCheck, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { AdminSession } from '../../../api/admin'
import { ATTENDANCE_STATUSES } from '../../../api/student'
import { Pagination } from '../../../components/Pagination'
import { Skeleton } from '../../../components/Skeleton'
import { StatusBadge } from '../../../components/StatusBadge'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { formatDate } from '../../../lib/format'
import { useSessions } from '../queries'
import { CreateSessionDialog } from './CreateSessionDialog'
import { SessionStateBadge } from './SessionStateBadge'

const PAGE_SIZE = 15
const COUNT_KEY = {
  PASSED: 'passed',
  NOT_PASSED: 'not_passed',
  ABSENT: 'absent',
  ABSENT_EXCUSED: 'absent_excused',
} as const

function Results({ session }: { session: AdminSession }) {
  const { t } = useTranslation()
  if (session.counts.marked === 0) {
    return <span className="text-sm text-muted-foreground">{t('sessions.noRecords')}</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ATTENDANCE_STATUSES.map((status) => {
        const count = session.counts[COUNT_KEY[status]]
        return count > 0 ? <StatusBadge key={status} status={status} count={count} /> : null
      })}
    </div>
  )
}

export function SessionsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const query = useSessions(page, PAGE_SIZE)
  const data = query.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('sessions.title')}</h1>
          <p className="text-muted-foreground">{t('sessions.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('sessions.add')}
        </Button>
      </div>

      {query.isPending && <Skeleton className="h-72 w-full" />}

      {query.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('sessions.loadFailed')}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">{t('sessions.empty')}</CardContent>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  {(['date', 'session', 'state', 'results'] as const).map((c) => (
                    <th key={c} scope="col" className="px-4 py-3 text-start font-medium">
                      {t(`sessions.columns.${c}`)}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">{t('history.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((session) => (
                  <tr key={session.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDate(session.session_date, lang)}</td>
                    <td className="px-4 py-3">{session.title ?? '—'}</td>
                    <td className="px-4 py-3">
                      <SessionStateBadge session={session} />
                    </td>
                    <td className="px-4 py-3">
                      <Results session={session} />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to={`/admin/sessions/${session.id}`}
                          aria-label={t('sessions.openAria', { date: formatDate(session.session_date, lang) })}
                        >
                          <ClipboardCheck className="size-4" aria-hidden="true" />
                          {t('sessions.open')}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {data.items.map((session) => (
              <li key={session.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{formatDate(session.session_date, lang)}</p>
                      {session.title && <p className="text-xs text-muted-foreground">{session.title}</p>}
                    </div>
                    <SessionStateBadge session={session} />
                  </div>
                  <Results session={session} />
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link
                      to={`/admin/sessions/${session.id}`}
                      aria-label={t('sessions.openAria', { date: formatDate(session.session_date, lang) })}
                    >
                      <ClipboardCheck className="size-4" aria-hidden="true" />
                      {t('sessions.open')}
                    </Link>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination page={page} pageCount={pageCount} onChange={setPage} disabled={query.isFetching} />
        </>
      )}

      <CreateSessionDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
