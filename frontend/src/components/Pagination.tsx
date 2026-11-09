import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '../lib/format'
import { Button } from './ui/button'

interface PaginationProps {
  page: number
  pageCount: number
  onChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ page, pageCount, onChange, disabled }: PaginationProps) {
  const { t, i18n } = useTranslation()
  if (pageCount <= 1) return null
  const lang = i18n.resolvedLanguage ?? 'en'

  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
      <Button variant="outline" size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="rtl-flip size-4" aria-hidden="true" />
        {t('common.previous')}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t('history.page', { page: formatNumber(page, lang, 0), pages: formatNumber(pageCount, lang, 0) })}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        {t('common.next')}
        <ChevronRight className="rtl-flip size-4" aria-hidden="true" />
      </Button>
    </nav>
  )
}
