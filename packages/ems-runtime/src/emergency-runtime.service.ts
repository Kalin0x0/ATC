import type {
  AtcEmsEmergency,
  AtcEmsEmergencyAudit,
  AtcAmbulanceUnit,
  AtcHospitalCapacity,
  AtcTriageCategory,
} from '@atc/shared-types'
import { ATC_EMS_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { EmergencyRepository } from './emergency.repository.js'
import type { AmbulanceDispatchService } from './ambulance-dispatch.service.js'
import type { HospitalCapacityService } from './hospital-capacity.service.js'
import type { MedicalEscalationService } from './medical-escalation.service.js'
import type { TriageService } from './triage.service.js'

export interface EmergencyRuntimeDeps {
  emergencyRepo: EmergencyRepository
  dispatchService: AmbulanceDispatchService
  capacityService: HospitalCapacityService
  escalationService: MedicalEscalationService
  triageService: TriageService
  eventBus: AtcEventBus | undefined
}

export interface CreateEmergencyInput {
  characterId: string
  incidentId?: string | null | undefined
  createdByPrincipalId: string
  notes?: string | null | undefined
}

export interface TriageInput {
  category: AtcTriageCategory
  principalId: string
  notes?: string | null | undefined
}

export interface AssignInput {
  responderUnitId: string
  principalId: string
}

export interface StabilizeInput {
  principalId: string
  notes?: string | null | undefined
}

export interface TransportInput {
  facilityId: string
  principalId: string
}

export interface CloseInput {
  principalId: string
  notes?: string | null | undefined
}

export class EmergencyRuntimeService {
  private readonly emergencyRepo: EmergencyRepository
  private readonly dispatchService: AmbulanceDispatchService
  private readonly capacityService: HospitalCapacityService
  private readonly escalationService: MedicalEscalationService
  private readonly triageService: TriageService
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: EmergencyRuntimeDeps) {
    this.emergencyRepo    = deps.emergencyRepo
    this.dispatchService  = deps.dispatchService
    this.capacityService  = deps.capacityService
    this.escalationService = deps.escalationService
    this.triageService    = deps.triageService
    this.eventBus         = deps.eventBus
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async createEmergency(input: CreateEmergencyInput): Promise<AtcEmsEmergency> {
    const emergency = await this.emergencyRepo.create(input)
    return emergency
  }

  // ── Triage ────────────────────────────────────────────────────────────────────

  async triage(id: string, input: TriageInput): Promise<AtcEmsEmergency> {
    const category = this.triageService.validate(input.category)
    const emergency = await this.emergencyRepo.triage({
      id,
      category,
      principalId: input.principalId,
      notes: input.notes,
    })
    // Escalate immediately for red-category patients
    this.escalationService.evaluateAndEscalate(emergency, input.principalId)
    return emergency
  }

  // ── Assign Responder ──────────────────────────────────────────────────────────

  async assignResponder(id: string, input: AssignInput): Promise<AtcEmsEmergency> {
    // Dispatch the ambulance unit (atomic — throws if unavailable)
    await this.dispatchService.dispatch(id, input.responderUnitId, input.principalId)
    // Assign to emergency (idempotent if already listed)
    const emergency = await this.emergencyRepo.assignResponder({
      id,
      responderPrincipalId: input.responderUnitId,
      principalId: input.principalId,
    })
    return emergency
  }

  // ── Stabilize ─────────────────────────────────────────────────────────────────

  async stabilize(id: string, input: StabilizeInput): Promise<AtcEmsEmergency> {
    const emergency = await this.emergencyRepo.transition({
      id,
      newStatus: 'stabilized',
      principalId: input.principalId,
      notes: input.notes,
    })
    this.eventBus?.emit(ATC_EMS_EVENTS.PATIENT_STABILIZED, { emergencyId: id, characterId: emergency.characterId }).catch(() => undefined)
    return emergency
  }

  // ── Transport ─────────────────────────────────────────────────────────────────

  async transport(id: string, input: TransportInput): Promise<AtcEmsEmergency> {
    // Decrement hospital bed count (atomic — throws if at capacity)
    await this.capacityService.admitPatient(input.facilityId)

    const emergency = await this.emergencyRepo.transition({
      id,
      newStatus: 'transported',
      principalId: input.principalId,
      metadata: { facilityId: input.facilityId },
    })
    this.eventBus?.emit(ATC_EMS_EVENTS.PATIENT_TRANSPORTED, {
      emergencyId: id,
      characterId: emergency.characterId,
      facilityId: input.facilityId,
    }).catch(() => undefined)
    return emergency
  }

  // ── Admit (called after transport arrives at hospital) ────────────────────────

  async admit(id: string, principalId: string): Promise<AtcEmsEmergency> {
    const emergency = await this.emergencyRepo.transition({
      id,
      newStatus: 'admitted',
      principalId,
    })
    this.eventBus?.emit(ATC_EMS_EVENTS.HOSPITAL_ADMITTED, {
      emergencyId: id,
      characterId: emergency.characterId,
    }).catch(() => undefined)
    return emergency
  }

  // ── Close ─────────────────────────────────────────────────────────────────────

  async close(id: string, input: CloseInput): Promise<AtcEmsEmergency> {
    return this.emergencyRepo.transition({
      id,
      newStatus: 'closed',
      principalId: input.principalId,
      notes: input.notes,
    })
  }

  // ── Queries ───────────────────────────────────────────────────────────────────

  async findById(id: string): Promise<AtcEmsEmergency | null> {
    return this.emergencyRepo.findById(id)
  }

  async listActive(): Promise<AtcEmsEmergency[]> {
    return this.emergencyRepo.listActive()
  }

  async listAudit(emergencyId: string): Promise<AtcEmsEmergencyAudit[]> {
    return this.emergencyRepo.listAudit(emergencyId)
  }

  async listActiveResponders(): Promise<AtcAmbulanceUnit[]> {
    return this.dispatchService.listActive()
  }

  async listAvailableResponders(): Promise<AtcAmbulanceUnit[]> {
    return this.dispatchService.listAvailable()
  }

  async getHospitalCapacity(): Promise<AtcHospitalCapacity[]> {
    return this.capacityService.listAll()
  }
}
