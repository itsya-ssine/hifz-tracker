import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../../../api/student'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Skeleton } from '../../../components/Skeleton'
import { Spinner } from '../../../components/Spinner'
import { StatusBadge } from '../../../components/StatusBadge'
import { useToast } from '../../../components/toast-context'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { ErrorBanner } from '../../../components/ui/error-banner'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { errorMessage } from '../../../lib/errors'
import { formatDate, formatNumber } from '../../../lib/format'
import { useSaveAttendance, useSessionDetail } from '../queries'
import { effective, isDirty, tally, toEntry, type Draft } from './attendance-draft'
import { SessionSettingsDialog } from './SessionSettingsDialog'
import { SessionStateBadge } from './SessionStateBadge'
import { StudentRow } from './StudentRow'

type ShowFilter = 'all' | 'unmarked' | 'marked'

export function SessionSheetPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { id } = useParams()
  const sessionId = Number(id)
  const validId = Number.isInteger(sessionId) && sessionId > 0
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const query = useSessionDetail(validId ? sessionId : 0)
  const save = useSaveAttendance(sessionId)

  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [search, setSearch] = useState('')
  const [show, setShow] = useState<ShowFilter>('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const leavingRef = useRef(false)

  const sheet = query.data
  const students = useMemo(() => sheet?.students ?? [], [sheet])
  const dirtyStudents = useMemo(
    () => students.filter((s) => drafts[s.student_id] && isDirty(s, drafts[s.student_id])),
    [students, drafts],
  )
  const dirtyCount = dirtyStudents.length
  const counts = useMemo(() => tally(students, drafts), [students, drafts])

  // Warn before losing unsaved marks: in-app navigation (router blocker) and closing the tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leavingRef.current && dirtyCount > 0 && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (dirtyCount === 0) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyCount])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return students.filter((s) => {
      if (term && !s.full_name.toLowerCase().includes(term) && !s.login.toLowerCase().includes(term)) return false
      const marked = effective(s, drafts).status !== null
      return show === 'all' || (show === 'marked' ? marked : !marked)
    })
  }, [students, drafts, search, show])

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="-ms-3 w-fit">
      <Link to="/admin/sessions">
        <ArrowLeft className="rtl-flip size-4" aria-hidden="true" />
        {t('sheet.back')}
      </Link>
    </Button>
  )

  function patchDraft(studentId: number, patch: Partial<Draft>) {
    const student = students.find((s) => s.student_id === studentId)
    if (!student) return
    setDrafts((current) => {
      const merged = { ...effective(student, current), ...patch }
      const next = { ...current }
      // Back to what is already saved (or still unmarked): nothing to keep.
      if (merged.status === null || !isDirty(student, merged)) delete next[studentId]
      else next[studentId] = merged
      return next
    })
  }

  function markUnmarkedShown(status: AttendanceStatus) {
    setDrafts((current) => {
      const next = { ...current }
      for (const student of visible) {
        if (effective(student, current).status === null) {
          next[student.student_id] = { status, excuse: '', note: '' }
        }
      }
      return next
    })
  }

  async function handleSave() {
    try {
      const result = await save.mutateAsync(dirtyStudents.map((s) => toEntry(s, drafts[s.student_id])))
      queryClient.setQueryData(['admin', 'session', sessionId], result.detail)
      setDrafts({})
      toast({ message: t('sheet.saved', { created: result.created, updated: result.updated }) })
    } catch {
      // The draft is kept so nothing is lost; the banner explains what went wrong.
    }
  }

  if (!validId || (query.error instanceof ApiError && query.error.status === 404)) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">{t('sheet.notFound')}</CardContent>
        </Card>
      </div>
    )
  }

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        {backLink}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (query.isError || !sheet) {
    return (
      <div className="space-y-4">
        {backLink}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('sheet.loadFailed')}
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { session } = sheet
  const cancelled = session.is_cancelled
  const heading = session.title ?? formatDate(session.session_date, lang)

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{heading}</h1>
            <SessionStateBadge session={session} />
          </div>
          <p className="text-muted-foreground">
            {session.title ? `${formatDate(session.session_date, lang)} · ` : ''}
            {session.notes}
          </p>
        </div>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" aria-hidden="true" />
          {t('sheet.settings')}
        </Button>
      </div>

      {cancelled && (
        <p role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          {t('sheet.cancelledBanner')}
        </p>
      )}

      <ul className="flex flex-wrap gap-2" aria-label={t('sheet.summary')}>
        {ATTENDANCE_STATUSES.map((status) => (
          <li key={status}>
            <StatusBadge status={status} count={counts[status]} />
          </li>
        ))}
        <li>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {t('sheet.unmarked')}
            <span className="tabular-nums">{counts.unmarked}</span>
          </span>
        </li>
      </ul>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sheet-search">{t('common.search')}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="sheet-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('sheet.searchPlaceholder')}
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sheet-show">{t('sheet.show')}</Label>
            <Select id="sheet-show" value={show} onChange={(e) => setShow(e.target.value as ShowFilter)}>
              <option value="all">{t('common.all')}</option>
              <option value="unmarked">{t('sheet.unmarked')}</option>
              <option value="marked">{t('sheet.marked')}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sheet-bulk">{t('sheet.bulkLabel')}</Label>
            <Select
              id="sheet-bulk"
              value=""
              disabled={cancelled}
              onChange={(e) => e.target.value && markUnmarkedShown(e.target.value as AttendanceStatus)}
            >
              <option value="">{t('sheet.bulkPlaceholder')}</option>
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {students.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">{t('sheet.empty')}</CardContent>
        </Card>
      )}
      {students.length > 0 && visible.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">{t('sheet.emptyFiltered')}</CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <ul className="space-y-3">
          {visible.map((student) => (
            <StudentRow
              key={student.student_id}
              student={student}
              draft={effective(student, drafts)}
              disabled={cancelled || save.isPending}
              onChange={(patch) => patchDraft(student.student_id, patch)}
            />
          ))}
        </ul>
      )}

      <div className="sticky bottom-4 z-10 space-y-2">
        {save.isError && <ErrorBanner message={errorMessage(t, save.error)} />}
        <Card className="shadow-lg">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p role="status" className="text-sm">
              {dirtyCount > 0
                ? t('sheet.unsaved', { count: formatNumber(dirtyCount, lang, 0) })
                : t('sheet.allSaved')}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={dirtyCount === 0 || save.isPending}
                onClick={() => {
                  setDrafts({})
                  save.reset()
                }}
              >
                {t('sheet.discard')}
              </Button>
              <Button disabled={dirtyCount === 0 || save.isPending || cancelled} onClick={() => void handleSave()}>
                {save.isPending && <Spinner />}
                {t('sheet.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SessionSettingsDialog
        session={session}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onDeleted={() => {
          leavingRef.current = true
          navigate('/admin/sessions', { replace: true })
        }}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset()
        }}
        title={t('sheet.leaveTitle')}
        description={t('sheet.leaveBody', { count: dirtyCount })}
        confirmLabel={t('sheet.leaveConfirm')}
        destructive
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
      />
    </div>
  )
}
