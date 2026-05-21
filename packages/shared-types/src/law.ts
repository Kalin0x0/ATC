// ── Agency ────────────────────────────────────────────────────────────────────

export type AtcAgencyType = 'police' | 'ems' | 'government' | 'court' | 'corrections'
export type AtcAgencyStatus = 'active' | 'inactive'

export interface AtcAgency {
  id: string
  slug: string
  name: string
  type: AtcAgencyType
  status: AtcAgencyStatus
  organizationId: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
}

// ── Warrants ──────────────────────────────────────────────────────────────────

export type AtcLawSeverity = 'infraction' | 'misdemeanor' | 'felony'
export type AtcWarrantStatus = 'active' | 'executed' | 'expired' | 'revoked'

export interface AtcWarrant {
  id: string
  characterId: string
  issuedByPrincipalId: string
  agencyId: string
  severity: AtcLawSeverity
  status: AtcWarrantStatus
  reason: string
  expiresAt: Date | null
  executedAt: Date | null
  revokedAt: Date | null
  revokeReason: string | null
  createdAt: Date
  updatedAt: Date
}

// ── Citations / Fines ─────────────────────────────────────────────────────────

export type AtcCitationStatus = 'unpaid' | 'paid' | 'voided' | 'disputed'

export interface AtcCitation {
  id: string
  characterId: string
  issuedByPrincipalId: string
  agencyId: string
  reason: string
  amount: number
  currency: string
  status: AtcCitationStatus
  ledgerJournalId: string | null
  idempotencyKey: string
  paidAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ── Arrest Records ────────────────────────────────────────────────────────────

export interface AtcArrestRecord {
  id: string
  characterId: string
  arrestedByPrincipalId: string
  agencyId: string
  warrantId: string | null
  reason: string
  severity: AtcLawSeverity
  notes: string | null
  createdAt: Date
}

// ── Jail State ────────────────────────────────────────────────────────────────

export type AtcJailStatus = 'active' | 'released'

export interface AtcJailRecord {
  id: string
  characterId: string
  arrestRecordId: string
  startAt: Date
  releaseAt: Date | null
  releasedByPrincipalId: string | null
  status: AtcJailStatus
  createdAt: Date
  updatedAt: Date
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface AtcCustodyEntry {
  principalId: string
  transferredAt: Date
  notes: string | null
}

export interface AtcEvidenceRecord {
  id: string
  caseId: string | null
  collectedByPrincipalId: string
  label: string
  metadata: Record<string, unknown> | null
  contentHash: string
  chainOfCustody: AtcCustodyEntry[]
  createdAt: Date
}

// ── Legal Cases ───────────────────────────────────────────────────────────────

export type AtcLegalCaseStatus = 'open' | 'closed' | 'archived'

export interface AtcLegalCase {
  id: string
  title: string
  status: AtcLegalCaseStatus
  agencyId: string
  createdByPrincipalId: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

// ── Events ────────────────────────────────────────────────────────────────────

export const ATC_LAW_EVENTS = {
  WARRANT_CREATED:    'atc:law:warrant:created',
  WARRANT_EXECUTED:   'atc:law:warrant:executed',
  WARRANT_EXPIRED:    'atc:law:warrant:expired',
  WARRANT_REVOKED:    'atc:law:warrant:revoked',
  CITATION_ISSUED:    'atc:law:citation:issued',
  CITATION_PAID:      'atc:law:citation:paid',
  ARREST_RECORDED:    'atc:law:arrest:recorded',
  JAIL_ENTERED:       'atc:law:jail:entered',
  JAIL_RELEASED:      'atc:law:jail:released',
  EVIDENCE_COLLECTED: 'atc:law:evidence:collected',
  CASE_CREATED:       'atc:law:case:created',
} as const

export type AtcLawEventName = typeof ATC_LAW_EVENTS[keyof typeof ATC_LAW_EVENTS]
