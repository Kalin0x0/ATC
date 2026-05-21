// Phase 29 — Medical Intelligence read-model contracts.
//
// The package depends on lightweight repository INTERFACES rather than the
// concrete @atc/medical package so it can ship independently of Agent 1's
// medical orchestration layer.

import type {
  AtcInjuryRecord,
  AtcTraumaRecord,
  AtcTreatmentRecord,
  AtcMedicalReport,
  AtcHospitalRecord,
  AtcTraumaState,
  AtcMedicalSeverity,
  AtcBodyRegion,
  AtcTreatmentType,
} from '@atc/shared-types'

// ── Read-only repository interfaces ──────────────────────────────────────────

export interface MedicalReadRepositories {
  injuries: {
    listByCharacter(characterId: string, limit?: number): Promise<AtcInjuryRecord[]>
    listByIncident?(incidentId: string, limit?: number): Promise<AtcInjuryRecord[]>
  }
  trauma: {
    listByCharacter(characterId: string, limit?: number): Promise<AtcTraumaRecord[]>
  }
  treatments: {
    listByCharacter(characterId: string, limit?: number): Promise<AtcTreatmentRecord[]>
    listByResponder?(principalId: string, limit?: number): Promise<AtcTreatmentRecord[]>
    listByIncident?(incidentId: string, limit?: number): Promise<AtcTreatmentRecord[]>
  }
  reports: {
    listByCharacter(characterId: string, limit?: number): Promise<AtcMedicalReport[]>
    listByIncident?(incidentId: string, limit?: number): Promise<AtcMedicalReport[]>
  }
  hospital: {
    listByCharacter(characterId: string, limit?: number): Promise<AtcHospitalRecord[]>
  }
}

// ── Projections ──────────────────────────────────────────────────────────────

export type MedicalTimelineKind =
  | 'injury_recorded'
  | 'trauma_changed'
  | 'treatment_applied'
  | 'hospital_admitted'
  | 'hospital_status_changed'
  | 'hospital_discharged'
  | 'medical_report_created'
  | 'patient_revived'
  | 'patient_deceased'

export interface MedicalTimelineEntry {
  at: Date
  kind: MedicalTimelineKind
  characterId: string
  detail: string
  incidentId: string | null
  injuryId: string | null
  treatmentId: string | null
  reportId: string | null
  hospitalId: string | null
  severity: AtcMedicalSeverity | null
  state: AtcTraumaState | null
  region: AtcBodyRegion | null
  treatmentType: AtcTreatmentType | null
}

export interface MedicalTimelinePage {
  characterId: string
  entries: MedicalTimelineEntry[]
  total: number
  limit: number
  cursor: string | null
  nextCursor: string | null
}

export interface ClinicalHistorySummary {
  characterId: string
  totalInjuries: number
  totalTreatments: number
  totalHospitalizations: number
  totalReports: number
  currentTrauma: AtcTraumaState | null
  injuriesBySeverity: Record<AtcMedicalSeverity, number>
  injuriesByRegion: Partial<Record<AtcBodyRegion, number>>
  treatmentsByType: Partial<Record<AtcTreatmentType, number>>
}

export interface TraumaAnalyticsResult {
  characterId: string
  windowDays: number
  repeatedInjuryRegions: Array<{ region: AtcBodyRegion; count: number }>
  traumaFrequencyPerWeek: number
  hospitalizationsInWindow: number
  revivesInWindow: number
  criticalEventsInWindow: number
  responderWorkload: Array<{ principalId: string; treatments: number }>
}

export interface MedicalRiskScore {
  characterId: string
  score: number
  factors: {
    chronicTrauma: number
    selfHarmIndicators: number
    repeatViolence: number
    highRiskResponderExposure: number
    incidentClustering: number
    emergencyEscalationFrequency: number
  }
  notes: string[]
}

export interface ResponderHistorySummary {
  principalId: string
  totalTreatments: number
  patientsTreated: number
  treatmentsByType: Partial<Record<AtcTreatmentType, number>>
  averageTreatmentsPerWeek: number
  recentPatients: string[]
}

export interface IncidentMedicalCorrelation {
  incidentId: string
  injuriesAtScene: AtcInjuryRecord[]
  treatmentsApplied: AtcTreatmentRecord[]
  reports: AtcMedicalReport[]
  uniquePatients: string[]
  responders: string[]
  severityBreakdown: Record<AtcMedicalSeverity, number>
}
