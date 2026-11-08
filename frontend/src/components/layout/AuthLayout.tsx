import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from '../BrandMark'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { ThemeToggle } from '../ThemeToggle'

/** Centered layout for login / forced password change. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex justify-end gap-1 p-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <BrandMark className="size-14 rounded-2xl" />
            <div>
              <p className="text-xl font-semibold">{t('app.name')}</p>
              <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
