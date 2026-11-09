import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { Spinner } from '../../../components/Spinner'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '../../../components/ui/dialog'
import { ErrorBanner } from '../../../components/ui/error-banner'
import { Field } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { errorMessage } from '../../../lib/errors'
import { useCreateSession } from '../queries'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mutation = useCreateSession()
  const [date, setDate] = useState(today)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!date) return setDateError(t('sessionForm.dateRequired'))
    setDateError(null)
    try {
      const session = await mutation.mutateAsync({
        session_date: date,
        title: title.trim() || null,
        notes: notes.trim() || null,
      })
      onDone()
      navigate(`/admin/sessions/${session.id}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_DATE_TAKEN') setDateError(errorMessage(t, error))
    }
  }

  const banner =
    mutation.isError && !(mutation.error instanceof ApiError && mutation.error.code === 'SESSION_DATE_TAKEN')
      ? errorMessage(t, mutation.error)
      : null

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorBanner message={banner} />
      <Field id="session-date" label={t('sessionForm.date')} error={dateError}>
        <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!dateError} />
      </Field>
      <Field id="session-title" label={t('sessionForm.titleLabel')}>
        <Input id="session-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </Field>
      <Field id="session-notes" label={t('sessionForm.notes')}>
        <Textarea id="session-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {t('sessionForm.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function CreateSessionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('sessionForm.title')} description={t('sessionForm.description')}>
        {open && <CreateForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
