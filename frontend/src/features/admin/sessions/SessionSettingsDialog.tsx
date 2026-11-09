import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { AdminSession, SessionUpdatePayload } from '../../../api/admin'
import { ApiError } from '../../../api/client'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { Spinner } from '../../../components/Spinner'
import { useToast } from '../../../components/toast-context'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '../../../components/ui/dialog'
import { ErrorBanner } from '../../../components/ui/error-banner'
import { Field } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { errorMessage } from '../../../lib/errors'
import { useDeleteSession, useUpdateSession } from '../queries'

interface SessionSettingsDialogProps {
  session: AdminSession
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after the session was deleted (the page navigates away). */
  onDeleted: () => void
}

function SettingsForm({ session, onDone, onDeleted }: { session: AdminSession; onDone: () => void; onDeleted: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const update = useUpdateSession(session.id)
  const remove = useDeleteSession(session.id)
  const hasRecords = session.counts.marked > 0

  const [date, setDate] = useState(session.session_date)
  const [title, setTitle] = useState(session.title ?? '')
  const [notes, setNotes] = useState(session.notes ?? '')
  const [cancelled, setCancelled] = useState(session.is_cancelled)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const changes: SessionUpdatePayload = {}
    if (date && date !== session.session_date) changes.session_date = date
    if ((title.trim() || null) !== session.title) changes.title = title.trim() || null
    if ((notes.trim() || null) !== session.notes) changes.notes = notes.trim() || null
    if (cancelled !== session.is_cancelled) changes.is_cancelled = cancelled
    if (Object.keys(changes).length === 0) return onDone()

    try {
      await update.mutateAsync(changes)
      toast({ message: t('sessionSettings.saved') })
      onDone()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_DATE_TAKEN') setDateError(errorMessage(t, error))
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync()
      toast({ message: t('sessionSettings.deleted') })
      setConfirmDelete(false)
      onDeleted()
    } catch {
      // error shown inside the confirmation dialog
    }
  }

  const banner =
    update.isError && !(update.error instanceof ApiError && update.error.code === 'SESSION_DATE_TAKEN')
      ? errorMessage(t, update.error)
      : null

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={banner} />
        <Field
          id="settings-date"
          label={t('sessionForm.date')}
          hint={hasRecords ? t('sessionSettings.dateLocked') : undefined}
          error={dateError}
        >
          <Input
            id="settings-date"
            type="date"
            value={date}
            disabled={hasRecords}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field id="settings-title" label={t('sessionForm.titleLabel')}>
          <Input id="settings-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field id="settings-notes" label={t('sessionForm.notes')}>
          <Textarea id="settings-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
        </Field>
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cancelled}
              disabled={hasRecords && !session.is_cancelled}
              onChange={(e) => setCancelled(e.target.checked)}
              className="size-4 accent-[var(--color-primary)]"
            />
            {t('sessionSettings.cancel')}
          </label>
          <p className="text-xs text-muted-foreground">
            {hasRecords && !session.is_cancelled ? t('sessionSettings.cancelLocked') : t('sessionSettings.cancelHint')}
          </p>
        </div>

        <div className="rounded-xl border border-destructive/30 p-4">
          <p className="text-sm font-medium">{t('sessionSettings.deleteTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {hasRecords ? t('sessionSettings.deleteLocked') : t('sessionSettings.deleteHint')}
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="mt-3"
            disabled={hasRecords}
            onClick={() => setConfirmDelete(true)}
          >
            {t('sessionSettings.delete')}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending && <Spinner />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open)
          if (!open) remove.reset()
        }}
        title={t('sessionSettings.confirmDeleteTitle')}
        description={t('sessionSettings.confirmDeleteBody')}
        confirmLabel={t('sessionSettings.delete')}
        destructive
        pending={remove.isPending}
        error={remove.isError ? errorMessage(t, remove.error) : null}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}

export function SessionSettingsDialog({ session, open, onOpenChange, onDeleted }: SessionSettingsDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('sessionSettings.title')} description={t('sessionSettings.description')}>
        {open && <SettingsForm session={session} onDone={() => onOpenChange(false)} onDeleted={onDeleted} />}
      </DialogContent>
    </Dialog>
  )
}
