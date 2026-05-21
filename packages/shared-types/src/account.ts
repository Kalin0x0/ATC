import type { AtcLocaleCode } from './locale.js'

export interface AtcAccount {
  id: string
  identifier: string
  licenses: string[]
  discordId: string | null
  fivemId: string | null
  lastIp: string | null
  createdAt: Date
  updatedAt: Date
  isBanned: boolean
}

export interface AtcCreateAccountDto {
  identifier: string
  licenses: string[]
  discordId?: string
  fivemId?: string
  lastIp?: string
}

// ── Phase 2 REST API types ────────────────────────────────────────────────────

export type AtcAccountStatus = 'active' | 'banned' | 'suspended'

export interface AtcAccountIdentifiers {
  license?: string
  license2?: string
  discord?: string
  steam?: string
  fivem?: string
}

export interface AtcAccountUpsertRequest {
  primaryIdentifier: string
  identifiers: AtcAccountIdentifiers
  preferredLanguage: AtcLocaleCode
}

export interface AtcAccountUpsertResponse {
  accountId: string
  status: AtcAccountStatus
  preferredLanguage: AtcLocaleCode
  created: boolean
}

export interface AtcBanCheckResponse {
  allowed: boolean
  status: AtcAccountStatus
  reason: string | null
  accountId: string | null
}
