import type { AtcEventBus } from '@atc/events'
import {
  ATC_LAW_EVENTS,
  ATC_DISPATCH_EVENTS,
  ATC_MEDICAL_EVENTS,
  ATC_COMMERCE_EVENTS,
  ATC_JOB_EVENTS,
} from '@atc/shared-types'
import type { RelationshipProjectionService } from './projection.service.js'

export interface CorrelationIngestServiceOptions {
  projection: RelationshipProjectionService
  eventBus: AtcEventBus
}

export interface IngestSubscription {
  /** Detach all subscriptions registered via this ingest service. */
  unsubscribe(): void
}

interface DomainPayloadShapes {
  // Each subscription extracts the fields it cares about with optional access;
  // unknown payload shapes are tolerated and silently skipped.
  characterId?: string
  agencyId?: string
  incidentId?: string
  arrestId?: string
  warrantId?: string
  citationId?: string
  evidenceId?: string
  callerIdentifier?: string | null
  principalId?: string
  responderId?: string
  organizationId?: string
  accountId?: string
  invoiceId?: string
  employeeId?: string
  contractId?: string
  patientId?: string
  hospitalId?: string
  treatmentId?: string
}

function read<T>(payload: unknown, ...keys: string[]): T | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  for (const k of keys) {
    const v = (payload as Record<string, unknown>)[k]
    if (v !== undefined && v !== null) return v as T
  }
  return undefined
}

/**
 * CorrelationIngestService — wires the event bus to the projection service.
 *
 * RULES:
 *   - Subscribes are READ-ONLY observers (no mutation of source events).
 *   - Each handler is fire-and-forget; the projection layer swallows errors.
 *   - Returns an `IngestSubscription` allowing the caller (test or shutdown
 *     code) to detach.
 */
export class CorrelationIngestService {
  private readonly projection: RelationshipProjectionService
  private readonly bus: AtcEventBus
  private readonly handlers: Array<{ event: string; handler: (p: unknown) => void }> = []

  constructor(opts: CorrelationIngestServiceOptions) {
    this.projection = opts.projection
    this.bus = opts.eventBus
  }

  start(): IngestSubscription {
    // ── LAW ───────────────────────────────────────────────────────────────
    this._sub(ATC_LAW_EVENTS.WARRANT_CREATED, (p) => {
      const char = read<string>(p, 'characterId')
      const warrant = read<string>(p, 'id', 'warrantId')
      const agency = read<string>(p, 'agencyId')
      if (!char || !warrant) return
      void this.projection.project({
        from: { type: 'character', externalId: char },
        to:   { type: 'warrant',   externalId: warrant },
        relationship: 'character_subject_of_warrant',
        attribution: agency ?? null,
      })
    })

    this._sub(ATC_LAW_EVENTS.ARREST_RECORDED, (p) => {
      const char = read<string>(p, 'characterId')
      const arrest = read<string>(p, 'id', 'arrestId')
      if (!char || !arrest) return
      void this.projection.project({
        from: { type: 'character', externalId: char },
        to:   { type: 'arrest',    externalId: arrest },
        relationship: 'character_subject_of_arrest',
      })
    })

    this._sub(ATC_LAW_EVENTS.CITATION_ISSUED, (p) => {
      const char = read<string>(p, 'characterId')
      const cit = read<string>(p, 'id', 'citationId')
      if (!char || !cit) return
      void this.projection.project({
        from: { type: 'character', externalId: char },
        to:   { type: 'citation',  externalId: cit },
        relationship: 'character_subject_of_citation',
      })
    })

    this._sub(ATC_LAW_EVENTS.EVIDENCE_COLLECTED, (p) => {
      const incident = read<string>(p, 'incidentId')
      const evidence = read<string>(p, 'id', 'evidenceId')
      if (!incident || !evidence) return
      void this.projection.project({
        from: { type: 'incident', externalId: incident },
        to:   { type: 'evidence', externalId: evidence },
        relationship: 'incident_links_evidence',
      })
    })

    // ── DISPATCH ──────────────────────────────────────────────────────────
    this._sub(ATC_DISPATCH_EVENTS.INCIDENT_CREATED, (p) => {
      const incident = read<string>(p, 'id', 'incidentId')
      const caller = read<string>(p, 'characterId', 'callerIdentifier')
      const agency = read<string>(p, 'agencyId')
      if (!incident) return
      if (caller) {
        void this.projection.project({
          from: { type: 'character', externalId: caller },
          to:   { type: 'incident',  externalId: incident },
          relationship: 'character_involved_in_incident',
          attribution: 'caller',
        })
      }
      if (agency) {
        void this.projection.project({
          from: { type: 'organization', externalId: agency },
          to:   { type: 'incident',     externalId: incident },
          relationship: 'character_involved_in_incident',
          attribution: 'agency',
        })
      }
    })

    this._sub(ATC_DISPATCH_EVENTS.RESPONDER_ASSIGNED, (p) => {
      const incident = read<string>(p, 'incidentId')
      const character = read<string>(p, 'characterId')
      if (!incident || !character) return
      void this.projection.project({
        from: { type: 'character', externalId: character },
        to:   { type: 'incident',  externalId: incident },
        relationship: 'character_involved_in_incident',
        attribution: 'responder',
      })
    })

    this._sub(ATC_DISPATCH_EVENTS.RESPONDER_STATUS_CHANGED, (p) => {
      const incident = read<string>(p, 'incidentId')
      const character = read<string>(p, 'characterId')
      const status = read<string>(p, 'status')
      if (!incident || !character || status !== 'cleared') return
      void this.projection.endProjection({
        from: { type: 'character', externalId: character },
        to:   { type: 'incident',  externalId: incident },
        relationship: 'character_involved_in_incident',
      })
    })

    // ── COMMERCE ──────────────────────────────────────────────────────────
    this._sub(ATC_COMMERCE_EVENTS.RECEIPT_CREATED, (p) => {
      const org = read<string>(p, 'organizationId')
      const account = read<string>(p, 'accountId', 'characterId')
      if (!org || !account) return
      void this.projection.project({
        from: { type: 'organization', externalId: org },
        to:   { type: 'account',       externalId: account },
        relationship: 'character_member_of_organization',
        attribution: 'commerce',
      })
    })

    // ── JOBS ──────────────────────────────────────────────────────────────
    this._sub(ATC_JOB_EVENTS.CONTRACT_CREATED, (p) => {
      const character = read<string>(p, 'characterId', 'employeeId')
      const org = read<string>(p, 'organizationId', 'employerId')
      if (!character || !org) return
      void this.projection.project({
        from: { type: 'character',    externalId: character },
        to:   { type: 'organization', externalId: org },
        relationship: 'character_member_of_organization',
        attribution: 'employment',
      })
    })

    this._sub(ATC_JOB_EVENTS.CONTRACT_TERMINATED, (p) => {
      const character = read<string>(p, 'characterId', 'employeeId')
      const org = read<string>(p, 'organizationId', 'employerId')
      if (!character || !org) return
      void this.projection.endProjection({
        from: { type: 'character',    externalId: character },
        to:   { type: 'organization', externalId: org },
        relationship: 'character_member_of_organization',
      })
    })

    // ── MEDICAL ───────────────────────────────────────────────────────────
    this._sub(ATC_MEDICAL_EVENTS.TREATMENT_APPLIED, (p) => {
      const responder = read<string>(p, 'principalId', 'responderId')
      const patient = read<string>(p, 'characterId', 'patientId')
      const incident = read<string>(p, 'incidentId')
      if (responder && patient) {
        void this.projection.project({
          from: { type: 'character', externalId: responder },
          to:   { type: 'character', externalId: patient },
          relationship: 'character_associated_with_character',
          attribution: 'medical-treatment',
        })
      }
      if (incident && patient) {
        void this.projection.project({
          from: { type: 'character', externalId: patient },
          to:   { type: 'incident',  externalId: incident },
          relationship: 'character_involved_in_incident',
          attribution: 'medical-patient',
        })
      }
    })

    return { unsubscribe: () => this._unsubscribeAll() }
  }

  private _sub(event: string, handler: (p: unknown) => void): void {
    this.bus.on(event, handler)
    this.handlers.push({ event, handler })
  }

  private _unsubscribeAll(): void {
    for (const { event, handler } of this.handlers) {
      this.bus.off(event, handler)
    }
    this.handlers.length = 0
  }

  // Exposed primarily for tests — counts registered subscriptions.
  get subscriptionCount(): number {
    return this.handlers.length
  }
}

// Make the typing of unused interfaces explicit for callers extending.
export type { DomainPayloadShapes }
