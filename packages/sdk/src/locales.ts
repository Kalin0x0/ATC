import type { AtcLocaleCode } from '@atc/shared-types'
import {
  getLocale,
  getAllLocales,
  getDirection,
  t,
  resolveLocale,
} from '@atc/locales'
import type { AtcLocaleBundle } from '@atc/locales'

export class AtcLocaleSDK {
  private _current: AtcLocaleCode = 'en'

  setLocale(code: string): AtcLocaleCode {
    this._current = resolveLocale(code)
    return this._current
  }

  getCurrent(): AtcLocaleCode {
    return this._current
  }

  getBundle(code?: AtcLocaleCode): AtcLocaleBundle {
    return getLocale(code ?? this._current)
  }

  getDirection(code?: AtcLocaleCode): 'ltr' | 'rtl' {
    return getDirection(code ?? this._current)
  }

  t(key: string, vars?: Record<string, string | number>): string {
    const bundle = getLocale(this._current)
    const result = t(bundle.translations, key, vars)
    if (result === key && this._current !== 'en') {
      const fallback = getLocale('en')
      return t(fallback.translations, key, vars)
    }
    return result
  }

  getAllBundles() {
    return getAllLocales()
  }

  resolve(code: string | undefined): AtcLocaleCode {
    return resolveLocale(code)
  }
}
