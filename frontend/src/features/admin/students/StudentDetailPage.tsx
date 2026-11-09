import { ArrowLeft, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import type { AdminStudent } from '../../../api/admin'
import { ApiError } from '../../../api/client'
import type { HistoryRecord } from '../../../api/student'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { CredentialsDialog } from '../../../components/CredentialsDialog'
import { Pagination } from '../../../components/Pagination'
import { QuranMap } from '../../../components/QuranMap'
import { Skeleton } from '../../../components/Skeleton'
import { StudentStatusBadge } from '../../../components/StudentStatusBadge'
import { useToast } from '../../../components/toast-context'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { errorMessage } from '../../../lib/errors'
import { formatDate } from '../../../lib/format'
import { HistoryList } from '../../progress/HistoryList'
import { OverviewHero, OverviewStats } from '../../progress/OverviewSections'
import {
  useDeleteRecord,
  useResetPassword,
  useStudentDetail,
  useStudentHistory,
  useStudentTimeline,
} from '../queries'
import { AuditTrail } from './AuditTrail'
import { CorrectRecordDialog } from './CorrectRecordDialog'
import { EditStudentDialog } from './EditStudentDialog'

// The charts library is large: load it only when this page shows charts.
const ProgressChart = lazy(() =>
  import('../../../components/charts/ProgressChart').then((m) => ({ default: m.ProgressChart })),
)
const StatusDonut = lazy(() =>
  import('../../../components/charts/StatusDonut').then((m) => ({ default: m.StatusDonut })),
)

const HISTORY_PAGE_SIZE = 10

function ProfileCard({ student }: { student: AdminStudent }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const rows: [string, string][] = [
    [t('studentForm.login'), student.login],
    [t('studentForm.email'), student.email ?? '—'],
    [t('studentForm.language'), student.preferred_lang === 'ar' ? 'العربية' : 'English'],
    [t('studentForm.joinedAt'), formatDate(student.joined_at, lang)],
    [
      t('studentDetail.profile.account'),
      student.is_active ? t('studentDetail.profile.enabled') : t('studentDetail.profile.disabled'),
    ],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('studentDetail.profile.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd dir="auto" className="mt-0.5 break-words font-medium">
                {value}
              </dd>
            </div>
          ))}
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">{t('studentForm.notes')}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{student.notes ?? t('studentDetail.profile.noNotes')}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function HistorySection({ studentId }: { studentId: number }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<HistoryRecord | null>(null)
  const [deleting, setDeleting] = useState<HistoryRecord | null>(null)
  const query = useStudentHistory(studentId, page, HISTORY_PAGE_SIZE)
  const remove = useDeleteRecord()
  const data = query.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  async function confirmDelete() {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast({ message: t('studentDetail.toasts.recordDeleted') })
      setDeleting(null)
      if (data && data.items.length === 1 && page > 1) setPage(page - 1)
    } catch {
      // error shown inside the dialog
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="history-heading">
      <h2 id="history-heading" className="text-lg font-semibold">
        {t('studentDetail.historyTitle')}
      </h2>
      {query.isPending && <Skeleton className="h-48 w-full" />}
      {query.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('history.loadFailed')}
        </p>
      )}
      {data && data.items.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">{t('history.empty')}</CardContent>
        </Card>
      )}
      {data && data.items.length > 0 && (
        <>
          <HistoryList
            records={data.items}
            renderActions={(record) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(record)}
                  aria-label={t('record.editAria', { date: formatDate(record.session_date, i18n.resolvedLanguage ?? 'en') })}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only" aria-hidden="true">
                    {t('common.edit')}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleting(record)}
                  aria-label={t('record.deleteAria', { date: formatDate(record.session_date, i18n.resolvedLanguage ?? 'en') })}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="sr-only md:not-sr-only" aria-hidden="true">
                    {t('common.delete')}
                  </span>
                </Button>
              </div>
            )}
          />
          <Pagination page={page} pageCount={pageCount} onChange={setPage} disabled={query.isFetching} />
        </>
      )}

      <CorrectRecordDialog record={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            remove.reset()
          }
        }}
        title={t('record.deleteTitle')}
        description={
          deleting
            ? t('record.deleteBody', { date: formatDate(deleting.session_date, i18n.resolvedLanguage ?? 'en') })
            : ''
        }
        confirmLabel={t('common.delete')}
        destructive
        pending={remove.isPending}
        error={remove.isError ? errorMessage(t, remove.error) : null}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  )
}

export function StudentDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const studentId = Number(id)
  const validId = Number.isInteger(studentId) && studentId > 0
  const detailQuery = useStudentDetail(validId ? studentId : 0)
  const timelineQuery = useStudentTimeline(validId ? studentId : 0)
  const reset = useResetPassword(studentId)
  const [editing, setEditing] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ms-3 w-fit">
      <Link to="/admin/students">
        <ArrowLeft className="rtl-flip size-4" aria-hidden="true" />
        {t('studentDetail.back')}
      </Link>
    </Button>
  )

  const notFound = detailQuery.error instanceof ApiError && detailQuery.error.status === 404
  if (!validId || notFound) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">{t('studentDetail.notFound')}</CardContent>
        </Card>
      </div>
    )
  }

  if (detailQuery.isPending) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        {backLink}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (detailQuery.isError) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('studentDetail.loadFailed')}
            </p>
            <Button variant="outline" onClick={() => void detailQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { student, overview } = detailQuery.data

  async function handleReset() {
    try {
      const result = await reset.mutateAsync()
      setConfirmingReset(false)
      setTemporaryPassword(result.temporary_password)
    } catch {
      // error shown inside the dialog
    }
  }

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{student.full_name}</h1>
            <StudentStatusBadge status={student.status} />
            {!student.is_active && (
              <span className="text-sm text-destructive">{t('studentDetail.profile.disabled')}</span>
            )}
          </div>
          <p dir="ltr" className="text-start text-muted-foreground">
            {student.login}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setConfirmingReset(true)}>
            <KeyRound className="size-4" aria-hidden="true" />
            {t('studentDetail.resetPassword')}
          </Button>
          <Button onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            {t('common.edit')}
          </Button>
        </div>
      </div>

      <OverviewHero overview={overview} subject="other" />
      <OverviewStats overview={overview} />

      <Card>
        <CardHeader>
          <CardTitle>{t('map.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <QuranMap currentIndex={student.current_index} />
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

      <ProfileCard student={student} />
      <HistorySection studentId={student.id} />
      <AuditTrail studentId={student.id} />

      <EditStudentDialog student={student} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={confirmingReset}
        onOpenChange={(open) => {
          setConfirmingReset(open)
          if (!open) reset.reset()
        }}
        title={t('studentDetail.resetTitle')}
        description={t('studentDetail.resetBody', { name: student.full_name })}
        confirmLabel={t('studentDetail.resetConfirm')}
        pending={reset.isPending}
        error={reset.isError ? errorMessage(t, reset.error) : null}
        onConfirm={() => void handleReset()}
      />
      <CredentialsDialog
        open={temporaryPassword !== null}
        onOpenChange={(open) => !open && setTemporaryPassword(null)}
        title={t('studentDetail.resetDoneTitle')}
        description={t('studentDetail.resetDoneBody', { name: student.full_name })}
        login={student.login}
        password={temporaryPassword}
      />
    </div>
  )
}
