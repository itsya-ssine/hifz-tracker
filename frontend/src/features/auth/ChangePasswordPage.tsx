import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Spinner } from '../../components/Spinner'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Label } from '../../components/ui/label'
import { PasswordInput } from '../../components/ui/password-input'
import { errorMessage } from '../../lib/errors'
import { homePathFor } from '../../lib/paths'
import { useAuth } from './auth-context'

const MIN_LENGTH = 8

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const { user, setUser, logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: (updated) => setUser(updated),
  })

  if (!user) return null
  // Leave only after the updated user (must_change_password = false) is in the auth state.
  if (mutation.isSuccess && !user.must_change_password) {
    return <Navigate to={homePathFor(user.role)} replace />
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (next.length < MIN_LENGTH) return setValidationError(t('changePassword.tooShort'))
    if (next !== confirm) return setValidationError(t('changePassword.mismatch'))
    setValidationError(null)
    mutation.mutate()
  }

  const error = validationError ?? (mutation.isError ? errorMessage(t, mutation.error) : null)

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('changePassword.title')}</CardTitle>
          <CardDescription>
            {user.must_change_password ? t('changePassword.forcedNotice') : t('changePassword.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="current">{t('changePassword.current')}</Label>
              <PasswordInput
                id="current"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">{t('changePassword.new')}</Label>
              <PasswordInput
                id="new"
                autoComplete="new-password"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                dir="ltr"
                className="text-start"
              />
              <p className="text-xs text-muted-foreground">{t('changePassword.hint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t('changePassword.confirm')}</Label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending || !current || !next || !confirm}
            >
              {mutation.isPending ? (
                <>
                  <Spinner /> {t('changePassword.submitting')}
                </>
              ) : (
                t('changePassword.submit')
              )}
            </Button>
            {user.must_change_password && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void logout()}
              >
                {t('common.logout')}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
