import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import type { Language } from '../api/types'
import { useAuth } from '../features/auth/auth-context'
import { Button } from './ui/button'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const { user, setUser } = useAuth()

  async function switchLanguage() {
    const next: Language = i18n.resolvedLanguage === 'ar' ? 'en' : 'ar'
    await i18n.changeLanguage(next)
    if (user) {
      try {
        setUser(await authApi.updateProfile({ preferred_lang: next }))
      } catch {
        // The UI language already changed; saving it on the account is best-effort.
      }
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={switchLanguage} aria-label={t('common.language')}>
      <Languages className="size-4" aria-hidden="true" />
      {t('common.switchLanguage')}
    </Button>
  )
}
