import { MessageSquarePlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { SheetStudent } from '../../../api/admin'
import type { AttendanceStatus } from '../../../api/student'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { cn } from '../../../lib/utils'
import { baseline, isDirty, type Draft } from './attendance-draft'
import { StatusChoice } from './StatusChoice'

interface StudentRowProps {
  student: SheetStudent
  draft: Draft
  disabled: boolean
  onChange: (patch: Partial<Draft>) => void
}

export function StudentRow({ student, draft, disabled, onChange }: StudentRowProps) {
  const { t } = useTranslation()
  const [noteOpen, setNoteOpen] = useState(draft.note !== '')
  const dirty = isDirty(student, draft)
  const hasSavedRecord = baseline(student).status !== null
  const showNote = noteOpen || draft.note !== ''

  return (
    <li
      className={cn(
        'space-y-3 rounded-xl border bg-card p-4',
        dirty ? 'border-accent/60 ring-1 ring-accent/30' : 'border-border',
      )}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <Link
            to={`/admin/students/${student.student_id}`}
            className="font-medium hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {student.full_name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {t('sheet.partToEvaluate')}:{' '}
            <span className="text-foreground">{t('quran.position', { hizb: student.hizb, part: student.part })}</span>
          </p>
        </div>
        <StatusChoice
          name={`status-${student.student_id}`}
          legend={t('sheet.resultFor', { name: student.full_name })}
          value={draft.status}
          disabled={disabled}
          onChange={(status: AttendanceStatus) => onChange({ status })}
        />
      </div>

      {draft.status === 'ABSENT_EXCUSED' && (
        <Input
          value={draft.excuse}
          onChange={(e) => onChange({ excuse: e.target.value })}
          placeholder={t('sheet.excuseReason')}
          aria-label={`${t('sheet.excuseReason')} — ${student.full_name}`}
          maxLength={500}
          disabled={disabled}
        />
      )}

      {showNote ? (
        <Input
          value={draft.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder={t('sheet.notePlaceholder')}
          aria-label={`${t('sheet.note')} — ${student.full_name}`}
          maxLength={500}
          disabled={disabled}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setNoteOpen(true)}
            disabled={disabled}
            aria-label={`${t('sheet.addNote')} — ${student.full_name}`}
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            {t('sheet.addNote')}
          </Button>
        </div>
      )}

      {dirty && !hasSavedRecord && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ status: null, excuse: '', note: '' })}
          aria-label={`${t('sheet.clearMark')} — ${student.full_name}`}
        >
          {t('sheet.clearMark')}
        </Button>
      )}
    </li>
  )
}
