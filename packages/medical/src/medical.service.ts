import type { AtcInjuryRecord, AtcTraumaRecord, AtcTreatmentRecord, AtcMedicalReport, AtcHospitalRecord, AtcReviveRequest, AtcTraumaState } from '@atc/shared-types'
import { ATC_MEDICAL_EVENTS } from '@atc/shared-types'
import type { AtcEventBus } from '@atc/events'
import type { InjuryRepository, RecordInjuryParams } from './injury.repository.js'
import type { TraumaRepository } from './trauma.repository.js'
import type { TreatmentRepository, ApplyTreatmentParams } from './treatment.repository.js'
import type { MedicalReportRepository, CreateMedicalReportParams } from './medical-report.repository.js'
import type { HospitalRepository, AdmitToHospitalParams, UpdateHospitalStatusParams } from './hospital.repository.js'
import { TraumaNotFoundError, PatientDeceasedError, PatientAlreadyAliveError } from './errors.js'

export interface MedicalVitalsBridge {
  patch(characterId: string, patch: Partial<Record<'health' | 'stamina' | 'stress', number>>): Promise<unknown>
}

export interface MedicalServiceDeps {
  injuryRepo: InjuryRepository
  traumaRepo: TraumaRepository
  treatmentRepo: TreatmentRepository
  reportRepo: MedicalReportRepository
  hospitalRepo: HospitalRepository
  eventBus: AtcEventBus | undefined
  vitalsBridge: MedicalVitalsBridge | undefined
}

export class MedicalService {
  private readonly injuryRepo: InjuryRepository
  private readonly traumaRepo: TraumaRepository
  private readonly treatmentRepo: TreatmentRepository
  private readonly reportRepo: MedicalReportRepository
  private readonly hospitalRepo: HospitalRepository
  private readonly eventBus: AtcEventBus | undefined
  private readonly vitalsBridge: MedicalVitalsBridge | undefined

  constructor(deps: MedicalServiceDeps) {
    this.injuryRepo    = deps.injuryRepo
    this.traumaRepo    = deps.traumaRepo
    this.treatmentRepo = deps.treatmentRepo
    this.reportRepo    = deps.reportRepo
    this.hospitalRepo  = deps.hospitalRepo
    this.eventBus      = deps.eventBus
    this.vitalsBridge  = deps.vitalsBridge
  }

  // ── Injuries ──────────────────────────────────────────────────────────────

  async recordInjury(params: RecordInjuryParams): Promise<AtcInjuryRecord> {
    const injury = await this.injuryRepo.record(params)
    this.eventBus?.emit(ATC_MEDICAL_EVENTS.INJURY_RECORDED, { injury }).catch(() => undefined)
    return injury
  }

  async getInjury(id: string): Promise<AtcInjuryRecord | null> {
    return this.injuryRepo.findById(id)
  }

  async listInjuriesByCharacter(characterId: string): Promise<AtcInjuryRecord[]> {
    return this.injuryRepo.listByCharacter(characterId)
  }

  // ── Trauma ────────────────────────────────────────────────────────────────

  async getOrCreateTrauma(characterId: string, principalId: string): Promise<AtcTraumaRecord> {
    return this.traumaRepo.getOrCreate(characterId, principalId)
  }

  async getTrauma(characterId: string): Promise<AtcTraumaRecord | null> {
    return this.traumaRepo.findByCharacter(characterId)
  }

  async updateTrauma(characterId: string, newState: AtcTraumaState, updatedByPrincipalId: string, notes?: string | null): Promise<AtcTraumaRecord> {
    const updated = await this.traumaRepo.transition({ characterId, newState, updatedByPrincipalId, notes })

    if (newState === 'deceased') {
      this.eventBus?.emit(ATC_MEDICAL_EVENTS.PATIENT_DECEASED, { characterId, updatedByPrincipalId }).catch(() => undefined)
      this.vitalsBridge?.patch(characterId, { health: 0, stamina: 0 }).catch(() => undefined)
    } else if (newState === 'cardiac_arrest') {
      this.eventBus?.emit(ATC_MEDICAL_EVENTS.TRAUMA_ESCALATED, { characterId, state: newState }).catch(() => undefined)
      this.vitalsBridge?.patch(characterId, { health: 5, stamina: 0, stress: 100 }).catch(() => undefined)
    } else if (newState === 'stabilized' || newState === 'stable') {
      this.eventBus?.emit(ATC_MEDICAL_EVENTS.PATIENT_STABILIZED, { characterId, state: newState }).catch(() => undefined)
    } else {
      this.eventBus?.emit(ATC_MEDICAL_EVENTS.TRAUMA_ESCALATED, { characterId, state: newState }).catch(() => undefined)
    }

    return updated
  }

  // ── Revive (requires ems.revive capability — enforced at route layer) ──────

  async revive(req: AtcReviveRequest): Promise<AtcTraumaRecord> {
    const current = await this.traumaRepo.findByCharacter(req.characterId)
    if (!current) throw new TraumaNotFoundError(req.characterId)
    if (current.state !== 'deceased') throw new PatientAlreadyAliveError(req.characterId, current.state)

    const revived = await this.traumaRepo.transition({
      characterId: req.characterId,
      newState: 'stable',
      updatedByPrincipalId: req.revivedByPrincipalId,
      notes: req.notes,
    })

    this.eventBus?.emit(ATC_MEDICAL_EVENTS.PLAYER_REVIVED, { characterId: req.characterId, revivedByPrincipalId: req.revivedByPrincipalId }).catch(() => undefined)
    this.vitalsBridge?.patch(req.characterId, { health: 50, stamina: 30, stress: 20 }).catch(() => undefined)

    return revived
  }

  // ── Treatments ────────────────────────────────────────────────────────────

  async applyTreatment(params: ApplyTreatmentParams): Promise<AtcTreatmentRecord> {
    const treatment = await this.treatmentRepo.apply(params)
    this.eventBus?.emit(ATC_MEDICAL_EVENTS.TREATMENT_APPLIED, { treatment }).catch(() => undefined)
    return treatment
  }

  async listTreatmentsByCharacter(characterId: string, limit?: number): Promise<AtcTreatmentRecord[]> {
    return this.treatmentRepo.listByCharacter(characterId, limit)
  }

  async getTreatment(id: string): Promise<AtcTreatmentRecord | null> {
    return this.treatmentRepo.findById(id)
  }

  // ── Medical Reports ───────────────────────────────────────────────────────

  async createMedicalReport(params: CreateMedicalReportParams): Promise<AtcMedicalReport> {
    const report = await this.reportRepo.create(params)
    this.eventBus?.emit(ATC_MEDICAL_EVENTS.MEDICAL_REPORT_CREATED, { report }).catch(() => undefined)
    return report
  }

  async closeMedicalReport(id: string, closedByPrincipalId: string): Promise<AtcMedicalReport> {
    return this.reportRepo.close(id, closedByPrincipalId)
  }

  async getMedicalReport(id: string): Promise<AtcMedicalReport | null> {
    return this.reportRepo.findById(id)
  }

  async listMedicalReports(params: Parameters<MedicalReportRepository['list']>[0]): Promise<Awaited<ReturnType<MedicalReportRepository['list']>>> {
    return this.reportRepo.list(params)
  }

  // ── Hospital ──────────────────────────────────────────────────────────────

  async admitToHospital(params: AdmitToHospitalParams): Promise<AtcHospitalRecord> {
    return this.hospitalRepo.admit(params)
  }

  async updateHospitalStatus(params: UpdateHospitalStatusParams): Promise<AtcHospitalRecord> {
    return this.hospitalRepo.updateStatus(params)
  }

  async getActiveHospitalRecord(characterId: string): Promise<AtcHospitalRecord | null> {
    return this.hospitalRepo.findActiveForCharacter(characterId)
  }

  async getHospitalRecord(id: string): Promise<AtcHospitalRecord | null> {
    return this.hospitalRepo.findById(id)
  }
}
