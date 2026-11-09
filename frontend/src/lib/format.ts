/** Locale used for dates and numbers. Arabic keeps Latin digits and the Gregorian calendar. */
export function localeFor(language: string): string {
  return language.startsWith('ar') ? 'ar-MA' : 'en-GB'
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

/** Format a YYYY-MM-DD string without any timezone shift. */
export function formatDate(
  iso: string,
  language: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return new Intl.DateTimeFormat(localeFor(language), { ...options, timeZone: 'UTC' }).format(
    parseIsoDate(iso),
  )
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
