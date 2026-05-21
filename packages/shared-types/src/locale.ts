export type AtcLocaleCode = 'en' | 'de' | 'fa'
export type AtcLocaleDirection = 'ltr' | 'rtl'

export interface AtcLocaleMeta {
  code: AtcLocaleCode
  name: string
  nativeName: string
  direction: AtcLocaleDirection
}

export type AtcTranslationValue = string | AtcTranslationMap
export type AtcTranslationMap = { [key: string]: AtcTranslationValue }

export interface AtcLocale {
  meta: AtcLocaleMeta
  translations: AtcTranslationMap
}

export const ATC_LOCALE_META: Record<AtcLocaleCode, AtcLocaleMeta> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
  },
  fa: {
    code: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    direction: 'rtl',
  },
}

export const ATC_SUPPORTED_LOCALES: readonly AtcLocaleCode[] = ['en', 'de', 'fa']
export const ATC_DEFAULT_LOCALE: AtcLocaleCode = 'en'

export function isValidLocaleCode(code: string): code is AtcLocaleCode {
  return ATC_SUPPORTED_LOCALES.includes(code as AtcLocaleCode)
}
