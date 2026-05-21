import type { AtcInjuryRecord, AtcTraumaRecord, AtcTreatmentRecord, AtcMedicalReport, AtcHospitalRecord, AtcReviveRequest, AtcTraumaState } from '@atc/shared-types'
import type { MedicalService } from './medical.service.js'
import type { RecordInjuryParams } from './injury.repository.js'
import type { ApplyTreatmentParams } from './treatment.repository.js'
import type { CreateMedicalReportParams, ListMedicalReportsParams, MedicalReportPage } from './medical-report.repository.js'
import type { AdmitToHospitalParams, UpdateHospitalStatusParams } from './hospital.repository.js'

export class AtcMedicalSDK {
  constructor(private readonly service: MedicalService) {}

  recordInjury(params: RecordInjuryParams): Promise<AtcInjuryRecord> {
    return this.service.recordInjury(params)
  }

  getInjury(id: string): Promise<AtcInjuryRecord | null> {
    return this.service.getInjury(id)
  }

  listInjuriesByCharacter(characterId: string): Promise<AtcInjuryRecord[]> {
    return this.service.listInjuriesByCharacter(characterId)
  }

  getOrCreateTrauma(characterId: string, principalId: string): Promise<AtcTraumaRecord> {
    return this.service.getOrCreateTrauma(characterId, principalId)
  }

  getTrauma(characterId: string): Promise<AtcTraumaRecord | null> {
    return this.service.getTrauma(characterId)
  }

  updateTrauma(characterId: string, newState: AtcTraumaState, updatedByPrincipalId: string, notes?: string | null): Promise<AtcTraumaRecord> {
    return this.service.updateTrauma(characterId, newState, updatedByPrincipalId, notes)
  }

  revive(req: AtcReviveRequest): Promise<AtcTraumaRecord> {
    return this.service.revive(req)
  }

  applyTreatment(params: ApplyTreatmentParams): Promise<AtcTreatmentRecord> {
    return this.service.applyTreatment(params)
  }

  listTreatmentsByCharacter(characterId: string, limit?: number): Promise<AtcTreatmentRecord[]> {
    return this.service.listTreatmentsByCharacter(characterId, limit)
  }

  getTreatment(id: string): Promise<AtcTreatmentRecord | null> {
    return this.service.getTreatment(id)
  }

  createMedicalReport(params: CreateMedicalReportParams): Promise<AtcMedicalReport> {
    return this.service.createMedicalReport(params)
  }

  closeMedicalReport(id: string, closedByPrincipalId: string): Promise<AtcMedicalReport> {
    return this.service.closeMedicalReport(id, closedByPrincipalId)
  }

  getMedicalReport(id: string): Promise<AtcMedicalReport | null> {
    return this.service.getMedicalReport(id)
  }

  listMedicalReports(params?: ListMedicalReportsParams): Promise<MedicalReportPage> {
    return this.service.listMedicalReports(params)
  }

  admitToHospital(params: AdmitToHospitalParams): Promise<AtcHospitalRecord> {
    return this.service.admitToHospital(params)
  }

  updateHospitalStatus(params: UpdateHospitalStatusParams): Promise<AtcHospitalRecord> {
    return this.service.updateHospitalStatus(params)
  }

  getActiveHospitalRecord(characterId: string): Promise<AtcHospitalRecord | null> {
    return this.service.getActiveHospitalRecord(characterId)
  }

  getHospitalRecord(id: string): Promise<AtcHospitalRecord | null> {
    return this.service.getHospitalRecord(id)
  }
}
