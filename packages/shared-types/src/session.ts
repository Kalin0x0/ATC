import type { AtcLocaleCode } from './locale.js'

// ── Phase 2 REST API types ────────────────────────────────────────────────────

export type AtcSessionStatus = 'connecting' | 'active' | 'ended'

export interface AtcSessionCreateRequest {
  accountId: string
  source: number
  name: string
  primaryIdentifier: string
  language: AtcLocaleCode
}

export interface AtcSessionResponse {
  sessionId: string
  accountId: string
  source: number
  language: AtcLocaleCode
  state: AtcSessionStatus
  characterId?: string | null
}

// ── Phase 1 types ─────────────────────────────────────────────────────────────

export interface AtcPlayerSession {
  id: string
  accountId: string
  characterId: string | null
  source: number
  identifier: string
  connectedAt: Date
  lastSeen: Date
  language: AtcLocaleCode
  ipAddress: string | null
  isActive: boolean
}

export interface AtcCreateSessionDto {
  accountId: string
  source: number
  identifier: string
  language: AtcLocaleCode
  ipAddress?: string
}

export interface AtcSessionState {
  source: number
  identifier: string
  language: AtcLocaleCode
  connectedAt: number
  lastSeen: number
  characterId: string | null
  isActive: boolean
}
