// ── Primitives ─────────────────────────────────────────────────────────────────

export type AtcMedicalSeverity = 'minor' | 'moderate' | 'critical' | 'fatal'

export type AtcBodyRegion =
  | 'head'
  | 'chest'
  | 'abdomen'
  | 'left_arm'
  | 'right_arm'
  | 'left_leg'
  | 'right_leg'
  | 'spine'

export type AtcTraumaState =
  | 'stable'
  | 'bleeding'
  | 'unconscious'
  | 'cardiac_arrest'
  | 'fractured'
  | 'pain_shock'
  | 'stabilized'
  | 'deceased'

export type AtcHospitalStatus = 'admitted' | 'icu' | 'surgery' | 'discharged' | 'deceased'

export type AtcTreatmentType =
  | 'bandage'
  | 'defibrillator'
  | 'medication'
  | 'splint'
  | 'tourniquet'
  | 'cpr'
  | 'revive'
  | 'stabilize'
  | 'transfer'
  | 'other'

// ── Injury Record ─────────────────────────────────────────────────────────────

export interface AtcInjuryRecord {
  id: string
  characterId: string
  agencyId: string | null
  incidentId: string | null
  recordedByPrincipalId: string
  region: AtcBodyRegion
  severity: AtcMedicalSeverity
  description: string
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// ── Trauma State ──────────────────────────────────────────────────────────────

export interface AtcTraumaRecord {
  id: string
  characterId: string
  state: AtcTraumaState
  previousState: AtcTraumaState | null
  updatedByPrincipalId: string
  notes: string | null
  stateChangedAt: Date
  createdAt: Date
  updatedAt: Date
}

// ── Treatment Record (append-only) ───────────────────────────────────────────

export interface AtcTreatmentRecord {
  id: string
  characterId: string
  appliedByPrincipalId: string
  incidentId: string | null
  type: AtcTreatmentType
  itemId: string | null
  notes: string | null
  previousTrauma: AtcTraumaState | null
  resultingTrauma: AtcTraumaState | null
  metadata: Record<string, unknown>
  appliedAt: Date
}

// ── Medical Report ────────────────────────────────────────────────────────────

export interface AtcMedicalReport {
  id: string
  characterId: string
  createdByPrincipalId: string
  incidentId: string | null
  arrestId: string | null
  diagnosis: string
  notes: string
  injuryIds: string[]
  treatmentIds: string[]
  vitalsSnapshot: Record<string, unknown> | null
  closedAt: Date | null
  closedByPrincipalId: string | null
  createdAt: Date
  updatedAt: Date
}

// ── Hospital Record ───────────────────────────────────────────────────────────

export interface AtcHospitalRecord {
  id: string
  characterId: string
  admittedByPrincipalId: string
  status: AtcHospitalStatus
  facilityId: string | null
  incidentId: string | null
  notes: string | null
  admittedAt: Date
  statusChangedAt: Date
  dischargedAt: Date | null
  updatedAt: Date
}

// ── Revive Request ────────────────────────────────────────────────────────────

export interface AtcReviveRequest {
  characterId: string
  revivedByPrincipalId: string
  incidentId: string | null
  notes: string | null
}

// ── Events ────────────────────────────────────────────────────────────────────

export const ATC_MEDICAL_EVENTS = {
  INJURY_RECORDED:        'atc:medical:injury:recorded',
  TRAUMA_ESCALATED:       'atc:medical:trauma:escalated',
  PLAYER_REVIVED:         'atc:medical:player:revived',
  TREATMENT_APPLIED:      'atc:medical:treatment:applied',
  MEDICAL_REPORT_CREATED: 'atc:medical:report:created',
  PATIENT_STABILIZED:     'atc:medical:patient:stabilized',
  PATIENT_DECEASED:       'atc:medical:patient:deceased',
} as const

export type AtcMedicalEventName = typeof ATC_MEDICAL_EVENTS[keyof typeof ATC_MEDICAL_EVENTS]
