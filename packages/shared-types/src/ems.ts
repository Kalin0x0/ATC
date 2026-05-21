// ── Emergency Status ──────────────────────────────────────────────────────────

export type AtcEmergencyStatus =
  | 'reported'
  | 'triaged'
  | 'responders_assigned'
  | 'en_route'
  | 'on_scene'
  | 'stabilized'
  | 'transported'
  | 'admitted'
  | 'closed'

export type AtcTriageCategory = 'red' | 'yellow' | 'green' | 'black'

export type AtcAmbulanceStatus =
  | 'available'
  | 'dispatched'
  | 'en_route'
  | 'transporting'
  | 'hospital'

// ── Domain Objects ────────────────────────────────────────────────────────────

export interface AtcEmsEmergency {
  id: string
  characterId: string
  incidentId: string | null
  status: AtcEmergencyStatus
  triageCategory: AtcTriageCategory | null
  assignedResponderIds: string[]
  notes: string | null
  createdByPrincipalId: string
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcEmsEmergencyAudit {
  id: string
  emergencyId: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  principalId: string
  notes: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface AtcAmbulanceUnit {
  id: string
  unitId: string
  status: AtcAmbulanceStatus
  emergencyId: string | null
  facilityId: string | null
  lastUpdatedBy: string
  createdAt: Date
  updatedAt: Date
}

export interface AtcHospitalCapacity {
  id: string
  facilityId: string
  totalBeds: number
  availableBeds: number
  icuTotal: number
  icuAvailable: number
  erTotal: number
  erAvailable: number
  isDiversion: boolean
  isOverflow: boolean
  updatedAt: Date
}

export interface AtcReviveAudit {
  id: string
  characterId: string
  emergencyId: string | null
  revivedByPrincipalId: string
  previousState: string
  resultingState: string
  notes: string | null
  revivedAt: Date
}

// ── Events ────────────────────────────────────────────────────────────────────

export const ATC_EMS_EVENTS = {
  EMS_DISPATCHED:      'atc:ems:emergency:dispatched',
  PATIENT_STABILIZED:  'atc:ems:patient:stabilized',
  PATIENT_TRANSPORTED: 'atc:ems:patient:transported',
  REVIVE_COMPLETED:    'atc:ems:revive:completed',
  HOSPITAL_ADMITTED:   'atc:ems:hospital:admitted',
  EMERGENCY_ESCALATED: 'atc:ems:emergency:escalated',
} as const
