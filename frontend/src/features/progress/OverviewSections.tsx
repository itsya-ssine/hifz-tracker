import { CalendarDays, CircleCheck, Flame, Percent, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Overview } from '../../api/student'
import { ProgressRing } from '../../components/ProgressRing'
import { StatCard } from '../../components/StatCard'
import { Card, CardContent } from '../../components/ui/card'
import { formatDate, formatNumber, formatPercent } from '../../lib/format'

/** `subject` decides the wording: "you" for the student's own dashboard, neutral for admins. */
export function OverviewHero({ overview, subject }: { overview: Overview; subject: 'self' | 'other' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { position, progress, completed } = overview
  const ns = subject === 'self' ? 'student' : 'adminStudent'

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <ProgressRing percent={progress.percent} />
        <div className="text-center sm:text-start">
          {completed ? (
            <>
              <Trophy className="mx-auto size-8 text-accent sm:mx-0" aria-hidden="true" />
              <h2 className="mt-2 text-2xl font-semibold">{t(`${ns}.completedTitle`)}</h2>
              {subject === 'self' && <p className="mt-1 text-muted-foreground">{t('student.completedBody')}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t(`${ns}.currentLabel`)}</p>
              <h2 className="mt-1 text-3xl font-semibold">
                {position && t('quran.position', { hizb: position.hizb, part: position.part })}
              </h2>
            </>
          )}
          <p className="mt-3 text-muted-foreground">
            {t('student.partsProgress', {
              done: formatNumber(progress.completed_parts, lang, 0),
              total: formatNumber(progress.total_parts, lang, 0),
            })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`${ns}.gained`, { count: formatNumber(progress.parts_gained, lang, 0) })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function OverviewStats({ overview }: { overview: Overview }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'en'
  const { stats, next_session: next } = overview

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={Percent}
        label={t('stats.attendanceRate')}
        value={formatPercent(stats.attendance_rate, lang)}
        hint={t('stats.attendanceHint', { rate: formatPercent(stats.adjusted_attendance_rate, lang) })}
      />
      <StatCard
        icon={CircleCheck}
        label={t('stats.passedSessions')}
        value={formatNumber(stats.passed, lang, 0)}
        hint={t('stats.passedHint', {
          passed: formatNumber(stats.passed, lang, 0),
          total: formatNumber(stats.total_sessions, lang, 0),
        })}
      />
      <StatCard
        icon={Flame}
        label={t('stats.streak')}
        value={formatNumber(stats.current_streak, lang, 0)}
        hint={t('stats.streakHint')}
      />
      <StatCard
        icon={CalendarDays}
        label={t('stats.nextSession')}
        value={next ? formatDate(next.session_date, lang) : '—'}
        hint={next ? (next.title ?? undefined) : t('stats.noNextSession')}
      />
    </div>
  )
}
