import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { AuditEntry } from '../../../api/admin'
import { Pagination } from '../../../components/Pagination'
import { Skeleton } from '../../../components/Skeleton'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { formatDate, formatDateTime } from '../../../lib/format'
import { indexToPosition } from '../../../lib/quran'
import { useStudentAudit } from '../queries'

const PAGE_SIZE = 8

const FIELD_KEYS = [
  'full_name', 'email', 'preferred_lang', 'is_active', 'notes', 'status', 'position', 'joined_at',
] as const

function describeValue(t: TFunction, field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return t(`studentStatus.${String(value)}`)
  if (field === 'is_active') return value ? t('studentDetail.profile.enabled') : t('studentDetail.profile.disabled')
  if (field === 'position' && typeof value === 'object') {
    const index = Number((value as { index?: number }).index)
    const pos = indexToPosition(index)
    return pos ? t('quran.position', pos) : t('students.finished')
  }
  if (field === 'preferred_lang') return value === 'ar' ? 'العربية' : 'English'
  return String(value)
}

function statusLabel(t: TFunction, value: unknown): string {
  return typeof value === 'string' ? t(`status.${value}`) : '—'
}

function describe(t: TFunction, lang: string, entry: AuditEntry): string {
  const oldV = entry.old_value ?? {}
  const newV = entry.new_value ?? {}
  // Only attendance entries carry a session date.
  const date = () => formatDate(String(newV.session_date ?? oldV.session_date ?? ''), lang)

  switch (entry.action) {
    case 'ATTENDANCE_CREATED':
      return t('audit.attendanceCreated', { date: date(), status: statusLabel(t, newV.status) })
    case 'ATTENDANCE_UPDATED':
      return t('audit.attendanceUpdated', {
        date: date(),
        from: statusLabel(t, oldV.status),
        to: statusLabel(t, newV.status),
      })
    case 'ATTENDANCE_DELETED':
      return t('audit.attendanceDeleted', { date: date(), status: statusLabel(t, oldV.status) })
    case 'STUDENT_CREATED':
      return t('audit.studentCreated')
    case 'PASSWORD_RESET':
      return t('audit.passwordReset')
    case 'STUDENT_UPDATED': {
      const changes = Object.keys(newV)
        .filter((key) => (FIELD_KEYS as readonly string[]).includes(key))
        .map(
          (key) =>
            `${t(`audit.fields.${key}`)}: ${describeValue(t, key, oldV[key])} → ${describeValue(t, key, newV[key])}`,
        )
      return t('audit.studentUpdated', { changes: changes.join('; ') })
    }
    default:
      return entry.action
  }
}

export function AuditTrail({ studentId }: { studentId: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const [page, setPage] = useState(1)
  const query = useStudentAudit(studentId, page, PAGE_SIZE)
  const data = query.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('studentDetail.auditTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending && <Skeleton className="h-32 w-full" />}
        {query.isError && (
          <div className="flex items-center gap-3">
            <p role="alert" className="text-sm text-destructive">
              {t('studentDetail.loadFailed')}
            </p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {data && data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('studentDetail.auditEmpty')}</p>
        )}
        {data && data.items.length > 0 && (
          <>
            <ol className="space-y-3">
              {data.items.map((entry) => (
                <li key={entry.id} className="border-s-2 border-border ps-4">
                  <p className="text-sm">{describe(t, lang, entry)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.actor_name ?? t('audit.system')} · {formatDateTime(entry.created_at, lang)}
                  </p>
                </li>
              ))}
            </ol>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} disabled={query.isFetching} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
