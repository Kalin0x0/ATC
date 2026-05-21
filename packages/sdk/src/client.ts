import type { AtcLocaleCode } from '@atc/shared-types'
import { AtcEventBus } from './events.js'
import { AtcSecuritySDK } from './security.js'
import { AtcLocaleSDK } from './locales.js'
import { AtcPluginRegistry } from './plugins.js'
import { AtcHttpClient } from './http-client.js'
import { AtcAccountsSDK } from './accounts.js'
import { AtcSessionsSDK } from './sessions.js'
import { AtcCharactersSDK } from './characters.js'
import { AtcWalletsSDK } from './wallets.js'
import { AtcItemsSDK } from './items.js'
import { AtcInventorySDK } from './inventory.js'
import { AtcVitalsSDK } from './vitals.js'
import { AtcStatusEffectsSDK } from './status-effects.js'

export interface AtcClientConfig {
  apiUrl: string
  serverToken: string
  serverId: string
  defaultLocale?: AtcLocaleCode
  apiTimeoutMs?: number
  debug?: boolean
}

export class AtcClient {
  readonly events: AtcEventBus
  readonly security: AtcSecuritySDK
  readonly locale: AtcLocaleSDK
  readonly plugins: AtcPluginRegistry
  readonly http: AtcHttpClient
  readonly accounts: AtcAccountsSDK
  readonly sessions: AtcSessionsSDK
  readonly characters: AtcCharactersSDK
  readonly wallets: AtcWalletsSDK
  readonly items: AtcItemsSDK
  readonly inventory: AtcInventorySDK
  readonly vitals: AtcVitalsSDK
  readonly statusEffects: AtcStatusEffectsSDK

  private _ready = false

  constructor(private readonly config: AtcClientConfig) {
    this.events = new AtcEventBus()
    this.security = new AtcSecuritySDK()
    this.locale = new AtcLocaleSDK()
    this.plugins = new AtcPluginRegistry()
    this.http = new AtcHttpClient(config.apiUrl, config.serverToken, config.apiTimeoutMs)
    this.accounts = new AtcAccountsSDK(this.http)
    this.sessions = new AtcSessionsSDK(this.http)
    this.characters = new AtcCharactersSDK(this.http)
    this.wallets = new AtcWalletsSDK(this.http)
    this.items = new AtcItemsSDK(this.http)
    this.inventory = new AtcInventorySDK(this.http)
    this.vitals = new AtcVitalsSDK(this.http)
    this.statusEffects = new AtcStatusEffectsSDK(this.http)

    if (config.defaultLocale) {
      this.locale.setLocale(config.defaultLocale)
    }
  }

  get isReady(): boolean {
    return this._ready
  }

  get apiUrl(): string {
    return this.config.apiUrl
  }

  get serverId(): string {
    return this.config.serverId
  }

  get debug(): boolean {
    return this.config.debug ?? false
  }

  initialize(): void {
    if (this._ready) return
    this._ready = true

    if (this.debug) {
      console.log(`[ATC] Client initialized — server: ${this.config.serverId}`)
    }
  }

  buildAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.serverToken}`,
      'X-ATC-Server-ID': this.config.serverId,
    }
  }
}

export function createAtcClient(config: AtcClientConfig): AtcClient {
  return new AtcClient(config)
}
