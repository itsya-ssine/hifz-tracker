import { afterEach, describe, expect, it } from 'vitest'
import ar from './ar.json'
import en from './en.json'
import i18n from './index'

afterEach(async () => {
  await i18n.changeLanguage('en')
})

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keys(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe('i18n', () => {
  it('has the same keys in English and Arabic', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort())
  })

  it('switches document direction and language for Arabic', async () => {
    await i18n.changeLanguage('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
    expect(i18n.t('auth.signIn')).toBe('تسجيل الدخول')

    await i18n.changeLanguage('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(document.documentElement.lang).toBe('en')
  })
})
