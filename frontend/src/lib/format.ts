/** Locale used for dates and numbers. Arabic keeps Latin digits and the Gregorian calendar. */
export function localeFor(language: string): string {
  return language.startsWith('ar') ? 'ar-MA' : 'en-GB'
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Format a YYYY-MM-DD string without any timezone shift. Returns a dash for missing or invalid input. */
export function formatDate(
  iso: string,
  language: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  const date = parseIsoDate(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(localeFor(language), { ...options, timeZone: 'UTC' }).format(date)
}

export function formatNumber(value: number, language: string, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(localeFor(language), { maximumFractionDigits }).format(value)
}

/** `fraction` is 0..1; null shows a dash. */
export function formatPercent(fraction: number | null, language: string): string {
  if (fraction === null) return '—'
  return new Intl.NumberFormat(localeFor(language), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraction)
}

/** Format a UTC timestamp ("2026-02-05 14:30:00" from SQLite, or ISO 8601) in the viewer's timezone. */
export function formatDateTime(timestamp: string, language: string): string {
  const iso = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T')
  const hasZone = /(Z|[+-]\d\d:\d\d)$/.test(iso)
  const date = new Date(hasZone ? iso : `${iso}Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(localeFor(language), { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
