import type { AtcWarrant } from './law.js'
import type { AtcArrestRecord } from './law.js'
import type { AtcCitation } from './law.js'
import type { AtcJailRecord } from './law.js'
import type { AtcEvidenceRecord } from './law.js'
import type {
  AtcBoloRecord,
  AtcIncident,
  AtcResponderAssignment,
  AtcResponderStatus,
} from './dispatch.js'

// ── MDT Character Profile ─────────────────────────────────────────────────────

export interface AtcMdtCharacterProfile {
  characterId: string
  activeWarrants: AtcWarrant[]
  arrestHistory: AtcArrestRecord[]
  citations: AtcCitation[]
  activeJail: AtcJailRecord | null
  activeBolo: AtcBoloRecord | null
  openIncidents: AtcIncident[]
}

// ── MDT Situation Snapshot ────────────────────────────────────────────────────

export interface AtcMdtSituationSnapshot {
  agencyId: string
  capturedAt: Date
  openIncidents: AtcIncident[]
  activeBolos: AtcBoloRecord[]
  activeWarrantCount: number
  jailedCount: number
}

// ── MDT Aggregated DTOs (Phase 25) ────────────────────────────────────────────

export interface AtcMdtWarrantSummary {
  characterId: string
  activeWarrants: AtcWarrant[]
  totalActive: number
  highestSeverity: 'infraction' | 'misdemeanor' | 'felony' | null
}

export interface AtcMdtEvidenceSummary {
  characterId: string
  caseIds: string[]
  evidence: AtcEvidenceRecord[]
  totalCount: number
}

export interface AtcMdtJailState {
  characterId: string
  current: AtcJailRecord | null
  isCurrentlyJailed: boolean
}

export interface AtcMdtResponderSummary {
  id: string
  incidentId: string
  principalId: string
  characterId: string | null
  agencyId: string
  status: AtcResponderStatus
  assignedAt: Date
  statusUpdatedAt: Date
  clearedAt: Date | null
}

export interface AtcMdtIncidentSummary {
  incident: AtcIncident
  responders: AtcMdtResponderSummary[]
  responderCount: number
  activeResponderCount: number
}

// ── MDT Search ────────────────────────────────────────────────────────────────

export type AtcMdtSearchResultType =
  | 'character'
  | 'incident'
  | 'bolo'
  | 'vehicle'

export interface AtcMdtSearchResultItem<T = unknown> {
  type: AtcMdtSearchResultType
  id: string
  label: string
  data: T
}

export interface AtcMdtSearchResult<T = unknown> {
  query: string
  type: AtcMdtSearchResultType
  items: AtcMdtSearchResultItem<T>[]
  total: number
  limit: number
  cursor: string | null
  nextCursor: string | null
}
