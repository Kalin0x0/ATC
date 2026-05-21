import type {
  AtcLocaleCode,
  AtcLocaleDirection,
  AtcTranslationMap,
} from '@atc/shared-types'

export interface AtcLocaleBundle {
  code: AtcLocaleCode
  direction: AtcLocaleDirection
  translations: AtcTranslationMap
}

export interface AtcLocaleRegistry {
  en: AtcLocaleBundle
  de: AtcLocaleBundle
  fa: AtcLocaleBundle
}

export type AtcTranslationInterpolation = Record<string, string | number>

export interface AtcLocaleLoader {
  load(code: AtcLocaleCode): Promise<AtcLocaleBundle>
  loadAll(): Promise<AtcLocaleRegistry>
}
