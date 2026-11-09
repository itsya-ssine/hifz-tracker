import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ATTENDANCE_STATUSES, type AttendanceStatus, type HistoryRecord } from '../../../api/student'
import { Spinner } from '../../../components/Spinner'
import { useToast } from '../../../components/toast-context'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '../../../components/ui/dialog'
import { ErrorBanner } from '../../../components/ui/error-banner'
import { Field } from '../../../components/ui/field'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { errorMessage } from '../../../lib/errors'
import { formatDate } from '../../../lib/format'
import { useCorrectRecord } from '../queries'

function CorrectForm({ record, onDone }: { record: HistoryRecord; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const mutation = useCorrectRecord()
  const [status, setStatus] = useState<AttendanceStatus>(record.status)
  const [excuse, setExcuse] = useState(record.excuse_note ?? '')
  const [note, setNote] = useState(record.admin_note ?? '')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await mutation.mutateAsync({
        recordId: record.id,
        changes: {
          status,
          excuse_note: status === 'ABSENT_EXCUSED' ? excuse.trim() || null : null,
          admin_note: note.trim() || null,
        },
      })
      toast({ message: t('studentDetail.toasts.recordUpdated') })
      onDone()
    } catch {
      // shown by the banner
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={mutation.isError ? errorMessage(t, mutation.error) : null} />
      <Field id="record-status" label={t('history.status')}>
        <Select id="record-status" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      {status === 'ABSENT_EXCUSED' && (
        <Field id="record-excuse" label={t('record.excuseNote')}>
          <Textarea id="record-excuse" value={excuse} onChange={(e) => setExcuse(e.target.value)} maxLength={500} />
        </Field>
      )}
      <Field id="record-note" label={t('record.adminNote')}>
        <Textarea id="record-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>
      <p className="text-xs text-muted-foreground">{t('record.ripple')}</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {t('record.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CorrectRecordDialog({
  record,
  onOpenChange,
}: {
  record: HistoryRecord | null
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  return (
    <Dialog open={record !== null} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('record.editTitle')}
        description={record ? t('record.editDescription', { date: formatDate(record.session_date, i18n.resolvedLanguage ?? 'en') }) : undefined}
      >
        {record && <CorrectForm key={record.id} record={record} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
