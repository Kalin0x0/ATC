import type { AtcLawSeverity } from './law.js'

// ── Primitives ─────────────────────────────────────────────────────────────────

export type AtcDispatchPriority = 'low' | 'medium' | 'high' | 'critical'
export type AtcIncidentStatus   = 'open' | 'active' | 'resolved' | 'archived'
export type AtcResponderStatus  = 'assigned' | 'enroute' | 'on_scene' | 'unavailable' | 'cleared'
export type AtcDispatchSource   = 'civilian' | 'officer' | 'automated' | 'api'
export type AtcBoloStatus       = 'active' | 'expired' | 'archived'

// ── Incidents ─────────────────────────────────────────────────────────────────

export interface AtcIncidentNote {
  principalId: string
  text: string
  createdAt: string // ISO-8601
}

export interface AtcIncident {
  id: string
  callId: string | null
  agencyId: string
  status: AtcIncidentStatus
  priority: AtcDispatchPriority
  title: string
  location: string | null
  notes: AtcIncidentNote[]
  evidenceIds: string[]
  arrestIds: string[]
  citationIds: string[]
  createdByPrincipalId: string
  resolvedAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ── Dispatch Calls ────────────────────────────────────────────────────────────

export interface AtcDispatchCall {
  id: string
  source: AtcDispatchSource
  callerIdentifier: string | null
  location: string
  priority: AtcDispatchPriority
  description: string
  incidentId: string | null
  idempotencyKey: string
  createdAt: Date
  acceptedAt: Date | null
  closedAt: Date | null
}

// ── Responder Assignments ─────────────────────────────────────────────────────

export interface AtcResponderAssignment {
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

// ── BOLO Records ──────────────────────────────────────────────────────────────

export interface AtcBoloNote {
  principalId: string
  text: string
  createdAt: string // ISO-8601
}

export interface AtcBoloRecord {
  id: string
  agencyId: string
  createdByPrincipalId: string
  severity: AtcLawSeverity
  description: string
  linkedWarrantId: string | null
  linkedCharacterId: string | null
  linkedVehicleId: string | null
  notes: AtcBoloNote[]
  status: AtcBoloStatus
  expiresAt: Date | null
  expiredAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ── Events ────────────────────────────────────────────────────────────────────

export const ATC_DISPATCH_EVENTS = {
  INCIDENT_CREATED:          'atc:dispatch:incident:created',
  INCIDENT_ESCALATED:        'atc:dispatch:incident:escalated',
  INCIDENT_RESOLVED:         'atc:dispatch:incident:resolved',
  DISPATCH_CREATED:          'atc:dispatch:call:created',
  DISPATCH_ACCEPTED:         'atc:dispatch:call:accepted',
  RESPONDER_ASSIGNED:        'atc:dispatch:responder:assigned',
  RESPONDER_STATUS_CHANGED:  'atc:dispatch:responder:status_changed',
  BOLO_CREATED:              'atc:dispatch:bolo:created',
  BOLO_EXPIRED:              'atc:dispatch:bolo:expired',
} as const

export type AtcDispatchEventName = typeof ATC_DISPATCH_EVENTS[keyof typeof ATC_DISPATCH_EVENTS]
