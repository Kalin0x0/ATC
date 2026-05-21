import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import type { AtcLocaleCode, AtcTranslationMap } from '@atc/shared-types'
import { isValidLocaleCode, ATC_DEFAULT_LOCALE, ATC_LOCALE_META } from '@atc/shared-types'
import type { AtcLocaleBundle, AtcLocaleRegistry, AtcTranslationInterpolation } from './types.js'

const _require = createRequire(import.meta.url)
const _dir = dirname(fileURLToPath(import.meta.url))

function loadJson(relativePath: string): AtcTranslationMap {
  const abs = join(_dir, relativePath)
  return _require(abs) as AtcTranslationMap
}

const LOCALE_REGISTRY: AtcLocaleRegistry = {
  en: {
    code: 'en',
    direction: 'ltr',
    translations: loadJson('../locales/en.json'),
  },
  de: {
    code: 'de',
    direction: 'ltr',
    translations: loadJson('../locales/de.json'),
  },
  fa: {
    code: 'fa',
    direction: 'rtl',
    translations: loadJson('../locales/fa.json'),
  },
}

export function getLocale(code: AtcLocaleCode): AtcLocaleBundle {
  return LOCALE_REGISTRY[code]
}

export function getAllLocales(): AtcLocaleRegistry {
  return LOCALE_REGISTRY
}

export function getDirection(code: AtcLocaleCode): 'ltr' | 'rtl' {
  return ATC_LOCALE_META[code].direction
}

export function t(
  translations: AtcTranslationMap,
  key: string,
  vars?: AtcTranslationInterpolation
): string {
  const parts = key.split('.')
  let value: string | AtcTranslationMap | undefined = translations

  for (const part of parts) {
    if (typeof value !== 'object' || value === null) return key
    value = (value as AtcTranslationMap)[part]
  }

  if (typeof value !== 'string') return key

  if (vars) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
      const replacement = vars[varName as keyof typeof vars]
      return replacement !== undefined ? String(replacement) : `{{${varName}}}`
    })
  }

  return value
}

export function resolveLocale(requested: string | undefined): AtcLocaleCode {
  if (requested && isValidLocaleCode(requested)) return requested
  return ATC_DEFAULT_LOCALE
}

export type { AtcLocaleBundle, AtcLocaleRegistry, AtcTranslationInterpolation } from './types.js'
