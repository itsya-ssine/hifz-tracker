import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { HistoryRecord } from '../../api/student'
import { StatusBadge } from '../../components/StatusBadge'
import { Card } from '../../components/ui/card'
import { formatDate } from '../../lib/format'

function notesOf(record: HistoryRecord): string | null {
  return [record.excuse_note, record.admin_note].filter(Boolean).join(' · ') || null
}

interface HistoryListProps {
  records: HistoryRecord[]
  /** Optional per-row actions (used by admins to correct or delete a record). */
  renderActions?: (record: HistoryRecord) => ReactNode
}

/** Table on larger screens, cards on phones. */
export function HistoryList({ records, renderActions }: HistoryListProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const columns = ['date', 'session', 'part', 'status', 'notes'] as const

  return (
    <>
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-3 text-start font-medium">
                  {t(`history.${column}`)}
                </th>
              ))}
              {renderActions && (
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  <span className="sr-only">{t('history.actions')}</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="whitespace-nowrap px-4 py-3">{formatDate(record.session_date, lang)}</td>
                <td className="px-4 py-3">{record.title ?? '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {t('quran.position', { hizb: record.hizb, part: record.part })}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{notesOf(record) ?? t('history.noNotes')}</td>
                {renderActions && <td className="whitespace-nowrap px-4 py-3 text-end">{renderActions(record)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="space-y-3 md:hidden">
        {records.map((record) => (
          <li key={record.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{formatDate(record.session_date, lang)}</p>
                  {record.title && <p className="text-xs text-muted-foreground">{record.title}</p>}
                </div>
                <StatusBadge status={record.status} />
              </div>
              <p className="mt-3 text-sm">{t('quran.position', { hizb: record.hizb, part: record.part })}</p>
              {notesOf(record) && <p className="mt-1 text-sm text-muted-foreground">{notesOf(record)}</p>}
              {renderActions && <div className="mt-3 flex justify-end">{renderActions(record)}</div>}
            </Card>
          </li>
        ))}
      </ul>
    </>
  )
}
