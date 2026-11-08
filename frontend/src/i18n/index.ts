import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ar from './ar.json'
import en from './en.json'

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const

function applyDocumentDirection(language: string) {
  const base = language.startsWith('ar') ? 'ar' : 'en'
  document.documentElement.lang = base
  document.documentElement.dir = base === 'ar' ? 'rtl' : 'ltr'
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
  })

i18n.on('languageChanged', applyDocumentDirection)
applyDocumentDirection(i18n.language)

export default i18n
