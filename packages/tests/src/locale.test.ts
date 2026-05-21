import { describe, it, expect } from 'vitest'
import {
  isValidLocaleCode,
  ATC_DEFAULT_LOCALE,
  ATC_SUPPORTED_LOCALES,
  ATC_LOCALE_META,
} from '@atc/shared-types'
import { getLocale, resolveLocale, t } from '@atc/locales'

describe('isValidLocaleCode', () => {
  it('accepts supported codes', () => {
    expect(isValidLocaleCode('en')).toBe(true)
    expect(isValidLocaleCode('de')).toBe(true)
    expect(isValidLocaleCode('fa')).toBe(true)
  })

  it('rejects unknown codes', () => {
    expect(isValidLocaleCode('fr')).toBe(false)
    expect(isValidLocaleCode('')).toBe(false)
    expect(isValidLocaleCode('EN')).toBe(false)
  })
})

describe('ATC_SUPPORTED_LOCALES', () => {
  it('is readonly — push must not exist as writable op', () => {
    // TypeScript enforces readonly; here we verify the value is stable
    expect(ATC_SUPPORTED_LOCALES).toEqual(['en', 'de', 'fa'])
    expect(ATC_SUPPORTED_LOCALES).toHaveLength(3)
  })
})

describe('resolveLocale', () => {
  it('returns the requested code when valid', () => {
    expect(resolveLocale('de')).toBe('de')
    expect(resolveLocale('fa')).toBe('fa')
  })

  it('falls back to default locale for unknown codes', () => {
    expect(resolveLocale('fr')).toBe(ATC_DEFAULT_LOCALE)
    expect(resolveLocale(undefined)).toBe(ATC_DEFAULT_LOCALE)
    expect(resolveLocale('')).toBe(ATC_DEFAULT_LOCALE)
  })
})

describe('ATC_LOCALE_META', () => {
  it('fa direction is rtl', () => {
    expect(ATC_LOCALE_META.fa.direction).toBe('rtl')
  })

  it('en and de direction is ltr', () => {
    expect(ATC_LOCALE_META.en.direction).toBe('ltr')
    expect(ATC_LOCALE_META.de.direction).toBe('ltr')
  })
})

describe('translation function t()', () => {
  const en = getLocale('en').translations
  const de = getLocale('de').translations
  const fa = getLocale('fa').translations

  it('resolves a known dot-notation key', () => {
    expect(t(en, 'common.loading')).toBe('Loading...')
    expect(t(de, 'common.loading')).toBe('Laden...')
  })

  it('returns the raw key for a missing key', () => {
    expect(t(en, 'common.does_not_exist')).toBe('common.does_not_exist')
    expect(t(en, 'nonexistent.key.chain')).toBe('nonexistent.key.chain')
  })

  it('interpolates {{vars}} correctly', () => {
    const result = t(en, 'security.ban_reason', { reason: 'cheating' })
    expect(result).toBe('Reason: cheating')
  })

  it('leaves unresolved vars as-is', () => {
    const result = t(en, 'security.ban_reason', {})
    expect(result).toBe('Reason: {{reason}}')
  })

  it('fa translations exist and are non-empty strings', () => {
    const result = t(fa, 'common.loading')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('common.loading')
  })

  it('all three locales have matching top-level keys', () => {
    const enKeys = Object.keys(en).filter((k) => k !== '_meta').sort()
    const deKeys = Object.keys(de).filter((k) => k !== '_meta').sort()
    const faKeys = Object.keys(fa).filter((k) => k !== '_meta').sort()
    expect(deKeys).toEqual(enKeys)
    expect(faKeys).toEqual(enKeys)
  })
})
