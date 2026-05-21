import type {
  AtcDispatchCall,
  AtcIncident,
  AtcResponderAssignment,
  AtcBoloRecord,
  AtcResponderStatus,
} from '@atc/shared-types'
import { ATC_DISPATCH_EVENTS } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { AtcEventBus } from '@atc/events'
import type {
  DispatchCallRepository,
  CreateDispatchCallParams,
} from './dispatch-call.repository.js'
import type {
  IncidentRepository,
  CreateIncidentParams,
  AddIncidentNoteParams,
} from './incident.repository.js'
import type {
  ResponderAssignmentRepository,
  CreateResponderAssignmentParams,
} from './responder-assignment.repository.js'
import type { BoloRepository, CreateBoloParams } from './bolo.repository.js'

export interface DispatchServiceOptions {
  calls: DispatchCallRepository
  incidents: IncidentRepository
  responders: ResponderAssignmentRepository
  bolos: BoloRepository
  eventBus: AtcEventBus | undefined
  telemetry: AtcTelemetryService | undefined
}

export class DispatchService {
  private readonly calls: DispatchCallRepository
  private readonly incidents: IncidentRepository
  private readonly responders: ResponderAssignmentRepository
  private readonly bolos: BoloRepository
  private readonly eventBus: AtcEventBus | undefined
  private readonly telemetry: AtcTelemetryService | undefined

  constructor(opts: DispatchServiceOptions) {
    this.calls     = opts.calls
    this.incidents = opts.incidents
    this.responders = opts.responders
    this.bolos     = opts.bolos
    this.eventBus  = opts.eventBus
    this.telemetry = opts.telemetry
  }

  // ── Dispatch Calls ──────────────────────────────────────────────────────────

  async createCall(params: CreateDispatchCallParams): Promise<AtcDispatchCall> {
    const call = await this.calls.create(params)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.DISPATCH_CREATED, { call })
    this.telemetry?.increment('dispatch.calls_created_total')
    return call
  }

  async acceptCall(callId: string, incidentId: string): Promise<AtcDispatchCall> {
    const call = await this.calls.accept(callId, incidentId)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.DISPATCH_ACCEPTED, { call })
    return call
  }

  // ── Incidents ───────────────────────────────────────────────────────────────

  async createIncident(params: CreateIncidentParams): Promise<AtcIncident> {
    const incident = await this.incidents.create(params)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.INCIDENT_CREATED, { incident })
    this.telemetry?.increment('dispatch.incidents_created_total')
    return incident
  }

  async escalateIncident(id: string): Promise<AtcIncident> {
    const incident = await this.incidents.escalate(id)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.INCIDENT_ESCALATED, { incident })
    return incident
  }

  async resolveIncident(id: string): Promise<AtcIncident> {
    const incident = await this.incidents.resolve(id)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.INCIDENT_RESOLVED, { incident })
    this.telemetry?.increment('dispatch.incidents_resolved_total')
    return incident
  }

  async archiveIncident(id: string): Promise<AtcIncident> {
    return this.incidents.archive(id)
  }

  async addIncidentNote(params: AddIncidentNoteParams): Promise<AtcIncident> {
    return this.incidents.addNote(params)
  }

  // ── Responders ──────────────────────────────────────────────────────────────

  async assignResponder(params: CreateResponderAssignmentParams): Promise<AtcResponderAssignment> {
    const assignment = await this.responders.create(params)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.RESPONDER_ASSIGNED, { assignment })
    this.telemetry?.increment('dispatch.responders_assigned_total')
    return assignment
  }

  async updateResponderStatus(id: string, status: AtcResponderStatus): Promise<AtcResponderAssignment> {
    const assignment = await this.responders.updateStatus(id, status)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.RESPONDER_STATUS_CHANGED, { assignment })
    return assignment
  }

  // ── BOLOs ────────────────────────────────────────────────────────────────────

  async createBolo(params: CreateBoloParams): Promise<AtcBoloRecord> {
    const bolo = await this.bolos.create(params)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.BOLO_CREATED, { bolo })
    this.telemetry?.increment('dispatch.bolos_created_total')
    return bolo
  }

  async expireBolo(id: string): Promise<AtcBoloRecord> {
    const bolo = await this.bolos.expire(id)
    this.eventBus?.emit(ATC_DISPATCH_EVENTS.BOLO_EXPIRED, { bolo })
    return bolo
  }

  async archiveBolo(id: string): Promise<AtcBoloRecord> {
    return this.bolos.archive(id)
  }
}
