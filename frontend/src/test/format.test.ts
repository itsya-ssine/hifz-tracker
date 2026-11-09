import { expect, it } from 'vitest'
import { formatDate, formatDateTime } from '../lib/format'
it('parses SQLite (UTC), Z and offset timestamps consistently', () => {
  const a = formatDateTime('2026-02-05 14:30:00', 'en')
  expect(formatDateTime('2026-02-05T14:30:00Z', 'en')).toBe(a)
  expect(formatDateTime('2026-02-05T15:30:00+01:00', 'en')).toBe(a)
})

it('never throws on missing or invalid dates', () => {
  expect(formatDate('', 'en')).toBe('—')
  expect(formatDate('not-a-date', 'ar')).toBe('—')
  expect(formatDateTime('garbage', 'en')).toBe('—')
})
