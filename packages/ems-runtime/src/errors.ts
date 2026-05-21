export class EmsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmsError'
  }
}

export class EmsValidationError extends EmsError {
  constructor(message: string) {
    super(message)
    this.name = 'EmsValidationError'
  }
}

export class EmergencyNotFoundError extends EmsError {
  constructor(id: string) {
    super(`EMS emergency not found: ${id}`)
    this.name = 'EmergencyNotFoundError'
  }
}

export class EmergencyClosedError extends EmsError {
  constructor(id: string) {
    super(`EMS emergency ${id} is closed and immutable`)
    this.name = 'EmergencyClosedError'
  }
}

export class EmergencyImmutableError extends EmsError {
  constructor(id: string, currentStatus: string, targetStatus: string) {
    super(`Cannot transition emergency ${id} from '${currentStatus}' to '${targetStatus}'`)
    this.name = 'EmergencyImmutableError'
  }
}

export class AmbulanceNotFoundError extends EmsError {
  constructor(unitId: string) {
    super(`Ambulance unit not found: ${unitId}`)
    this.name = 'AmbulanceNotFoundError'
  }
}

export class AmbulanceUnavailableError extends EmsError {
  constructor(unitId: string, status: string) {
    super(`Ambulance unit ${unitId} is unavailable (status: ${status})`)
    this.name = 'AmbulanceUnavailableError'
  }
}

export class HospitalCapacityNotFoundError extends EmsError {
  constructor(facilityId: string) {
    super(`Hospital capacity record not found for facility: ${facilityId}`)
    this.name = 'HospitalCapacityNotFoundError'
  }
}

export class HospitalAtCapacityError extends EmsError {
  constructor(facilityId: string) {
    super(`Hospital ${facilityId} is at capacity — no available beds`)
    this.name = 'HospitalAtCapacityError'
  }
}

export class ReviveCooldownError extends EmsError {
  constructor(characterId: string, cooldownSeconds: number) {
    super(`Character ${characterId} was recently revived — cooldown: ${cooldownSeconds}s`)
    this.name = 'ReviveCooldownError'
  }
}

export class TriageValidationError extends EmsError {
  constructor(message: string) {
    super(`Triage validation failed: ${message}`)
    this.name = 'TriageValidationError'
  }
}
