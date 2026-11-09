import { ArrowDownAZ, ArrowUpAZ, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import type { AdminStudent, StudentSort } from '../../../api/admin'
import type { StudentStatus } from '../../../api/student'
import { Pagination } from '../../../components/Pagination'
import { ProgressBar } from '../../../components/ProgressBar'
import { Skeleton } from '../../../components/Skeleton'
import { StatusBadge } from '../../../components/StatusBadge'
import { StudentStatusBadge } from '../../../components/StudentStatusBadge'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { Select } from '../../../components/ui/select'
import { formatNumber, formatPercent } from '../../../lib/format'
import { useDebouncedValue } from '../../../lib/use-debounced-value'
import { CreateStudentDialog } from './CreateStudentDialog'
import { useStudents } from '../queries'

const PAGE_SIZE = 15
const STATUSES: StudentStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'LEFT']
const SORTS: StudentSort[] = ['name', 'position', 'attendance', 'joined']
const HIZB_NUMBERS = Array.from({ length: 60 }, (_, i) => i + 1)

function StudentName({ student }: { student: AdminStudent }) {
  const { t } = useTranslation()
  return (
    <div className="min-w-0">
      <Link
        to={`/admin/students/${student.id}`}
        className="font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {student.full_name}
      </Link>
      <p dir="ltr" className="truncate text-start text-xs text-muted-foreground">
        {student.login}
        {!student.is_active && <span className="ms-2 text-destructive">· {t('students.disabled')}</span>}
      </p>
    </div>
  )
}

function PositionText({ student }: { student: AdminStudent }) {
  const { t } = useTranslation()
  return student.position
    ? t('quran.position', { hizb: student.position.hizb, part: student.position.part })
    : t('students.finished')
}

export function StudentsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)

  // The URL is the source of truth, so filters survive reloads and the back button.
  const search = params.get('q') ?? ''
  const status = (STATUSES as string[]).includes(params.get('status') ?? '')
    ? (params.get('status') as StudentStatus)
    : undefined
  const hizb = Number(params.get('hizb')) || undefined
  const sort = (SORTS as string[]).includes(params.get('sort') ?? '') ? (params.get('sort') as StudentSort) : 'name'
  const order = params.get('order') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, Number(params.get('page')) || 1)

  function update(changes: Record<string, string | undefined>, keepPage = false) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!keepPage) next.delete('page')
    setParams(next, { replace: true })
  }

  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebouncedValue(searchInput.trim())
  useEffect(() => {
    if (debouncedSearch !== search) update({ q: debouncedSearch || undefined })
    // Only push the debounced input into the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const query = useStudents({ search: search || undefined, status, hizb, sort, order, page, pageSize: PAGE_SIZE })
  const data = query.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const hasFilters = Boolean(search || status || hizb)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('students.title')}</h1>
          <p className="text-muted-foreground">{t('students.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('students.add')}
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="student-search">{t('common.search')}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="student-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('students.searchPlaceholder')}
                className="ps-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-status">{t('students.statusFilter')}</Label>
            <Select
              id="student-status"
              value={status ?? ''}
              onChange={(e) => update({ status: e.target.value || undefined })}
            >
              <option value="">{t('common.all')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`studentStatus.${s}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-hizb">{t('students.hizbFilter')}</Label>
            <Select
              id="student-hizb"
              value={hizb ?? ''}
              onChange={(e) => update({ hizb: e.target.value || undefined })}
            >
              <option value="">{t('common.all')}</option>
              {HIZB_NUMBERS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="student-sort">{t('students.sortBy')}</Label>
            <Select id="student-sort" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`students.sort.${s}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="icon"
              onClick={() => update({ order: order === 'asc' ? 'desc' : 'asc' })}
              aria-label={t(`students.order.${order}`)}
              title={t(`students.order.${order}`)}
            >
              {order === 'asc' ? (
                <ArrowDownAZ className="size-4" aria-hidden="true" />
              ) : (
                <ArrowUpAZ className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {query.isPending && <Skeleton className="h-80 w-full" />}

      {query.isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p role="alert" className="text-destructive">
              {t('students.loadFailed')}
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
            {hasFilters ? t('students.emptyFiltered') : t('students.empty')}
          </CardContent>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {t('students.total', { count: formatNumber(data.total, lang, 0) })}
          </p>

          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  {(['student', 'position', 'progress', 'attendance', 'lastSession', 'status'] as const).map((c) => (
                    <th key={c} scope="col" className="px-4 py-3 text-start font-medium">
                      {t(`students.columns.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((student) => (
                  <tr key={student.id}>
                    <td className="px-4 py-3">
                      <StudentName student={student} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <PositionText student={student} />
                    </td>
                    <td className="w-40 px-4 py-3">
                      <ProgressBar percent={student.progress_percent} label={t('students.columns.progress')} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatNumber(student.progress_percent, lang)}%
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatPercent(student.attendance_rate, lang)}</td>
                    <td className="px-4 py-3">
                      {student.last_status ? <StatusBadge status={student.last_status} /> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StudentStatusBadge status={student.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 md:hidden">
            {data.items.map((student) => (
              <li key={student.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <StudentName student={student} />
                    <StudentStatusBadge status={student.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <PositionText student={student} />
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {t('students.columns.attendance')}: {formatPercent(student.attendance_rate, lang)}
                    </span>
                  </div>
                  <ProgressBar percent={student.progress_percent} label={t('students.columns.progress')} />
                  {student.last_status && <StatusBadge status={student.last_status} />}
                </Card>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={(next) => update({ page: next > 1 ? String(next) : undefined }, true)}
            disabled={query.isFetching}
          />
        </>
      )}

      <CreateStudentDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
