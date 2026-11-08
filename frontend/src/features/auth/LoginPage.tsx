import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Spinner } from '../../components/Spinner'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { PasswordInput } from '../../components/ui/password-input'
import { errorMessage } from '../../lib/errors'
import { homePathFor } from '../../lib/paths'
import { useAuth } from './auth-context'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({ mutationFn: () => login(identifier.trim(), password) })

  // Redirect declaratively once the signed-in user is in the auth state (navigating from
  // onSuccess would race with the cache update and bounce back through the route guards).
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : homePathFor(user.role)} replace />
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('auth.title')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mutation.isError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {errorMessage(t, mutation.error)}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="login">{t('auth.login')}</Label>
              <Input
                id="login"
                name="login"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending || !identifier.trim() || !password}
            >
              {mutation.isPending ? (
                <>
                  <Spinner /> {t('auth.signingIn')}
                </>
              ) : (
                t('auth.signIn')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
