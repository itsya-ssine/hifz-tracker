import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin', className)} aria-hidden="true" />
}

export function FullScreenLoader() {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground"
    >
      <Spinner className="size-5" />
      <span>{t('common.loading')}</span>
    </div>
  )
}
