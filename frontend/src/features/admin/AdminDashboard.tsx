import { LayoutDashboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '../../components/ui/card'
import { useAuth } from '../auth/auth-context'

export function AdminDashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('admin.welcome', { name: user?.full_name })}</h1>
        <p className="text-muted-foreground">{t('admin.subtitle')}</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-accent">
            <LayoutDashboard className="size-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold">{t('admin.emptyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('admin.emptyBody')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
