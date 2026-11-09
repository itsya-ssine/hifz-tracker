import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../features/auth/auth-context'
import { homePathFor } from '../../lib/paths'
import { BrandMark } from '../BrandMark'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { ThemeToggle } from '../ThemeToggle'
import { Button } from '../ui/button'

export function AppShell() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  if (!user) return null

  const home = homePathFor(user.role)
  const navItems =
    user.role === 'STUDENT'
      ? [
          { to: home, label: 'nav.dashboard' },
          { to: '/student/history', label: 'nav.history' },
        ]
      : [{ to: home, label: 'nav.dashboard' }]

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <NavLink to={homePathFor(user.role)} className="flex items-center gap-2.5">
            <BrandMark />
            <span className="hidden text-base font-semibold sm:inline">{t('app.name')}</span>
          </NavLink>

          <nav className="ms-2 flex items-center gap-1" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <div className="me-2 hidden text-end leading-tight md:block">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{t(`roles.${user.role}`)}</p>
            </div>
            <LanguageSwitcher />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label={t('common.logout')}>
              <LogOut className="rtl-flip size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
