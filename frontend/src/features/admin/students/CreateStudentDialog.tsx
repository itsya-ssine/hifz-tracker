import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudentCreated } from '../../../api/admin'
import { ApiError } from '../../../api/client'
import type { Position } from '../../../api/student'
import type { Language } from '../../../api/types'
import { CredentialsDialog } from '../../../components/CredentialsDialog'
import { PositionPicker } from '../../../components/PositionPicker'
import { Spinner } from '../../../components/Spinner'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '../../../components/ui/dialog'
import { ErrorBanner } from '../../../components/ui/error-banner'
import { Field } from '../../../components/ui/field'
import { Input } from '../../../components/ui/input'
import { PasswordInput } from '../../../components/ui/password-input'
import { Select } from '../../../components/ui/select'
import { Textarea } from '../../../components/ui/textarea'
import { errorMessage } from '../../../lib/errors'
import { useCreateStudent } from '../queries'

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface FieldErrors {
  login?: string
  full_name?: string
  email?: string
  password?: string
}

export function CreateStudentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const mutation = useCreateStudent()
  const [login, setLogin] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [start, setStart] = useState<Position>({ hizb: 1, part: 1 })
  const [lang, setLang] = useState<Language>('en')
  const [joinedAt, setJoinedAt] = useState(today)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [created, setCreated] = useState<StudentCreated | null>(null)

  function reset() {
    setLogin('')
    setFullName('')
    setEmail('')
    setPassword('')
    setStart({ hizb: 1, part: 1 })
    setLang('en')
    setJoinedAt(today())
    setNotes('')
    setErrors({})
    setCreated(null)
    mutation.reset()
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {}
    if (!LOGIN_RE.test(login.trim().toLowerCase())) found.login = t('studentForm.errors.loginInvalid')
    if (!fullName.trim()) found.full_name = t('studentForm.errors.nameRequired')
    if (email.trim() && !EMAIL_RE.test(email.trim())) found.email = t('studentForm.errors.emailInvalid')
    if (password && password.length < 8) found.password = t('studentForm.errors.passwordShort')
    return found
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    try {
      const result = await mutation.mutateAsync({
        login: login.trim().toLowerCase(),
        full_name: fullName.trim(),
        email: email.trim() || null,
        password: password || null,
        start_hizb: start.hizb,
        start_part: start.part,
        preferred_lang: lang,
        joined_at: joinedAt || null,
        notes: notes.trim() || null,
      })
      setCreated(result)
    } catch (error) {
      // Show conflicts next to the field that caused them.
      if (error instanceof ApiError && error.code === 'LOGIN_TAKEN') {
        setErrors({ login: errorMessage(t, error) })
      } else if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setErrors({ email: errorMessage(t, error) })
      }
    }
  }

  const bannerError =
    mutation.isError &&
    !(mutation.error instanceof ApiError && ['LOGIN_TAKEN', 'EMAIL_TAKEN'].includes(mutation.error.code))
      ? errorMessage(t, mutation.error)
      : null

  if (created) {
    return (
      <CredentialsDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t('studentForm.createdTitle')}
        description={
          created.temporary_password
            ? t('studentForm.createdBody', { name: created.full_name })
            : t('studentForm.createdBodyChosen', { name: created.full_name })
        }
        login={created.login}
        password={created.temporary_password}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent title={t('studentForm.title')} description={t('studentForm.description')}>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <ErrorBanner message={bannerError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="new-login" label={t('studentForm.login')} hint={t('studentForm.loginHint')} error={errors.login}>
              <Input
                id="new-login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                dir="ltr"
                className="text-start"
                aria-invalid={!!errors.login}
              />
            </Field>
            <Field id="new-name" label={t('studentForm.fullName')} error={errors.full_name}>
              <Input
                id="new-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={!!errors.full_name}
              />
            </Field>
          </div>
          <Field id="new-email" label={t('studentForm.email')} error={errors.email}>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="text-start"
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field
            id="new-password"
            label={t('studentForm.password')}
            hint={t('studentForm.passwordHint')}
            error={errors.password}
          >
            <PasswordInput
              id="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              dir="ltr"
              className="text-start"
              aria-invalid={!!errors.password}
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('studentForm.startPosition')}</legend>
            <PositionPicker idPrefix="new-start" value={start} onChange={setStart} />
            <p className="text-xs text-muted-foreground">{t('studentForm.startPositionHint')}</p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="new-lang" label={t('studentForm.language')}>
              <Select id="new-lang" value={lang} onChange={(e) => setLang(e.target.value as Language)}>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </Select>
            </Field>
            <Field id="new-joined" label={t('studentForm.joinedAt')} hint={t('studentForm.joinedAtHint')}>
              <Input id="new-joined" type="date" value={joinedAt} onChange={(e) => setJoinedAt(e.target.value)} />
            </Field>
          </div>
          <Field id="new-notes" label={t('studentForm.notes')}>
            <Textarea id="new-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              {t('studentForm.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
