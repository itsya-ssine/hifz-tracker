import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminStudent, StudentUpdatePayload } from '../../../api/admin'
import type { Position } from '../../../api/student'
import type { Language } from '../../../api/types'
import { PositionPicker } from '../../../components/PositionPicker'
import { Spinner } from '../../../components/Spinner'
import { useToast } from '../../../components/toast-context'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '../../../components/ui/dialog'
import { ErrorBanner } from '../../../components/ui/error-banner'
import { Field } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { errorMessage } from '../../../lib/errors'
import { useUpdateStudent } from '../queries'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface EditStudentDialogProps {
  student: AdminStudent
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Mounted only while open, so the form always starts from the student's current values. */
function EditForm({ student, onDone }: { student: AdminStudent; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const mutation = useUpdateStudent(student.id)
  const completed = student.status === 'COMPLETED'

  const [fullName, setFullName] = useState(student.full_name)
  const [email, setEmail] = useState(student.email ?? '')
  const [lang, setLang] = useState<Language>(student.preferred_lang)
  const [status, setStatus] = useState(student.status)
  const [enabled, setEnabled] = useState(student.is_active)
  const [joinedAt, setJoinedAt] = useState(student.joined_at)
  const [notes, setNotes] = useState(student.notes ?? '')
  const [position, setPosition] = useState<Position>(student.position ?? { hizb: 1, part: 1 })
  const [validation, setValidation] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!fullName.trim()) return setValidation(t('studentForm.errors.nameRequired'))
    if (email.trim() && !EMAIL_RE.test(email.trim())) return setValidation(t('studentForm.errors.emailInvalid'))
    setValidation(null)

    // Send only what actually changed.
    const changes: StudentUpdatePayload = {}
    if (fullName.trim() !== student.full_name) changes.full_name = fullName.trim()
    if ((email.trim() || null) !== student.email) changes.email = email.trim() || null
    if (lang !== student.preferred_lang) changes.preferred_lang = lang
    if (!completed && status !== student.status && status !== 'COMPLETED') changes.status = status
    if (enabled !== student.is_active) changes.is_active = enabled
    if (joinedAt && joinedAt !== student.joined_at) changes.joined_at = joinedAt
    if ((notes.trim() || null) !== student.notes) changes.notes = notes.trim() || null
    if (
      student.position &&
      (position.hizb !== student.position.hizb || position.part !== student.position.part)
    ) {
      changes.position = position
    }

    if (Object.keys(changes).length === 0) return onDone()
    try {
      await mutation.mutateAsync(changes)
      toast({ message: t('studentDetail.toasts.updated') })
      onDone()
    } catch {
      // The error banner below shows the translated message.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <ErrorBanner message={validation ?? (mutation.isError ? errorMessage(t, mutation.error) : null)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="edit-name" label={t('studentForm.fullName')}>
          <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field id="edit-email" label={t('studentForm.email')}>
          <Input
            id="edit-email"
            type="email"
            dir="ltr"
            className="text-start"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="edit-lang" label={t('studentForm.language')}>
          <Select id="edit-lang" value={lang} onChange={(e) => setLang(e.target.value as Language)}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </Select>
        </Field>
        <Field
          id="edit-status"
          label={t('editStudent.status')}
          hint={completed ? t('editStudent.statusLocked') : undefined}
        >
          <Select
            id="edit-status"
            value={status}
            disabled={completed}
            onChange={(e) => setStatus(e.target.value as AdminStudent['status'])}
          >
            {(completed ? ['COMPLETED'] : ['ACTIVE', 'PAUSED', 'LEFT']).map((s) => (
              <option key={s} value={s}>
                {t(`studentStatus.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="edit-joined" label={t('studentForm.joinedAt')} hint={t('studentForm.joinedAtHint')}>
          <Input id="edit-joined" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
        </Field>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">{t('editStudent.account')}</span>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            {t('editStudent.accountEnabled')}
          </label>
          <p className="text-xs text-muted-foreground">{t('editStudent.accountEnabledHint')}</p>
        </div>
      </div>
      <Field id="edit-notes" label={t('studentForm.notes')}>
        <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </Field>
      {student.position && (
        <fieldset className="space-y-2 rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">{t('editStudent.correctPosition')}</legend>
          <PositionPicker idPrefix="edit-position" value={position} onChange={setPosition} />
          <p className="text-xs text-muted-foreground">{t('editStudent.correctPositionHint')}</p>
        </fieldset>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {t('editStudent.submit')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditStudentDialog({ student, open, onOpenChange }: EditStudentDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('editStudent.title')} description={student.full_name} className="max-w-xl">
        {open && <EditForm student={student} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
