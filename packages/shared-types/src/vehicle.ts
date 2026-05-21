// ── Vehicle Status & Category ─────────────────────────────────────────────────

export type AtcVehicleStatus =
  | 'stored'
  | 'spawned'
  | 'active'
  | 'impounded'
  | 'destroyed'

export type AtcVehicleCategory =
  | 'civilian'
  | 'police'
  | 'ems'
  | 'fire'
  | 'government'
  | 'other'

export type AtcImpoundReason =
  | 'traffic_stop'
  | 'abandoned'
  | 'evidence'
  | 'unpaid_fees'
  | 'emergency_tow'
  | 'other'

// ── Domain Objects ────────────────────────────────────────────────────────────

export interface AtcVehicle {
  id: string
  ownerId: string | null
  organizationId: string | null
  plate: string
  vin: string
  model: string
  category: AtcVehicleCategory
  status: AtcVehicleStatus
  fuel: number
  bodyHealth: number
  engineHealth: number
  mileage: number
  garageId: string | null
  lastX: number | null
  lastY: number | null
  lastZ: number | null
  lastHeading: number | null
  isLocked: boolean
  isEngineOn: boolean
  colorPrimary: string | null
  colorSecondary: string | null
  modHash: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcVehicleRuntime {
  id: string
  vehicleId: string
  spawnedByPrincipalId: string
  netId: number | null
  serverHandle: number | null
  x: number
  y: number
  z: number
  heading: number
  fuel: number
  bodyHealth: number
  engineHealth: number
  isLocked: boolean
  isEngineOn: boolean
  lastHeartbeatAt: Date
  expiresAt: Date | null
  spawnedAt: Date
  updatedAt: Date
}

export interface AtcVehicleGarageRecord {
  id: string
  vehicleId: string
  garageId: string
  storedByPrincipalId: string
  storedAt: Date
  retrievedAt: Date | null
  retrievedByPrincipalId: string | null
}

export interface AtcVehicleImpound {
  id: string
  vehicleId: string
  reason: AtcImpoundReason
  impoundedByPrincipalId: string
  agencyId: string | null
  locationId: string | null
  evidenceHold: boolean
  fee: number
  notes: string | null
  impoundedAt: Date
  releasedAt: Date | null
  releasedByPrincipalId: string | null
  releaseNotes: string | null
}

export interface AtcVehicleFleetAssignment {
  id: string
  vehicleId: string
  organizationId: string | null
  principalId: string | null
  assignedByPrincipalId: string
  role: string
  expiresAt: Date | null
  unassignedAt: Date | null
  unassignedByPrincipalId: string | null
  assignedAt: Date
}

export interface AtcVehicleWithRuntime {
  vehicle: AtcVehicle
  runtime: AtcVehicleRuntime | null
}

export interface AtcGarageSummary {
  garageId: string
  vehicleCount: number
}

// ── Events ────────────────────────────────────────────────────────────────────

export const ATC_VEHICLE_EVENTS = {
  VEHICLE_SPAWNED:    'atc:vehicle:spawned',
  VEHICLE_STORED:     'atc:vehicle:stored',
  VEHICLE_IMPOUNDED:  'atc:vehicle:impounded',
  VEHICLE_RELEASED:   'atc:vehicle:released',
  VEHICLE_DESTROYED:  'atc:vehicle:destroyed',
  FLEET_ASSIGNED:     'atc:vehicle:fleet:assigned',
  FLEET_UNASSIGNED:   'atc:vehicle:fleet:unassigned',
} as const
