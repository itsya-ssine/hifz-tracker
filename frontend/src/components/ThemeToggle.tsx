import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'

export function ThemeToggle() {
  const { t } = useTranslation()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // storage unavailable: the theme still applies for this visit
    }
    setDark(next)
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('common.theme')}>
      {dark ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
    </Button>
  )
}
