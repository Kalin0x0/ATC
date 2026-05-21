export type AtcFuelGrade = 'regular' | 'premium' | 'diesel' | 'electric'

export type AtcVehicleRegistrationStatus = 'active' | 'expired' | 'suspended' | 'revoked'

export type AtcVehicleViolationType =
  | 'speeding'
  | 'reckless_driving'
  | 'running_red_light'
  | 'wrong_way'
  | 'illegal_parking'
  | 'hit_and_run'
  | 'dui'
  | 'other'

export type AtcPursuitStatus = 'active' | 'ended' | 'escaped' | 'terminated'

export interface AtcVehicleFuel {
  id: string
  vehicleRuntimeId: string
  tankCapacity: number
  currentFuel: number
  fuelGrade: AtcFuelGrade
  consumptionRate: number
  lastRefuelAt: Date | null
  lastSyncAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface AtcVehicleDamageRuntime {
  id: string
  vehicleRuntimeId: string
  engineHealth: number
  bodyHealth: number
  fuelTankHealth: number
  panelDamage: Record<string, number>
  tireState: Record<string, string>
  isEngineDestroyed: boolean
  isOnFire: boolean
  lastSyncAt: Date
  updatedAt: Date
}

export interface AtcVehicleRegistration {
  id: string
  vehicleId: string
  ownerPrincipalId: string
  plate: string
  status: AtcVehicleRegistrationStatus
  registeredAt: Date
  expiresAt: Date
  renewedAt: Date | null
  suspendedAt: Date | null
  revokedAt: Date | null
  revokedByPrincipalId: string | null
}

export interface AtcVehicleTrafficViolation {
  id: string
  vehicleId: string
  vehicleRuntimeId: string | null
  principalId: string
  violationType: AtcVehicleViolationType
  speedRecorded: number | null
  speedLimit: number | null
  locationX: number | null
  locationY: number | null
  locationZ: number | null
  recordedByPrincipalId: string | null
  fineAmount: number
  isPaid: boolean
  paidAt: Date | null
  createdAt: Date
}

export interface AtcVehiclePursuit {
  id: string
  vehicleRuntimeId: string
  suspectPrincipalId: string
  initiatingOfficerPrincipalId: string
  initiatingAgencyId: string | null
  status: AtcPursuitStatus
  pursuitNonce: string
  startLocationX: number | null
  startLocationY: number | null
  startLocationZ: number | null
  endLocationX: number | null
  endLocationY: number | null
  endLocationZ: number | null
  startedAt: Date
  endedAt: Date | null
  notes: string | null
}

export interface AtcVehicleRuntimeMetrics {
  id: string
  vehicleRuntimeId: string
  distanceTraveled: number
  topSpeedRecorded: number
  totalCollisions: number
  engineRuntimeMinutes: number
  lastHeartbeatAt: Date
  createdAt: Date
  updatedAt: Date
}

export const ATC_VEHICLE_SIM_EVENTS = {
  PURSUIT_STARTED:          'atc:vehicle:pursuit:started',
  PURSUIT_ENDED:            'atc:vehicle:pursuit:ended',
  REGISTRATION_EXPIRED:     'atc:vehicle:registration:expired',
  REGISTRATION_SUSPENDED:   'atc:vehicle:registration:suspended',
  REGISTRATION_REVOKED:     'atc:vehicle:registration:revoked',
} as const

export type AtcVehicleSimEventName = typeof ATC_VEHICLE_SIM_EVENTS[keyof typeof ATC_VEHICLE_SIM_EVENTS]
