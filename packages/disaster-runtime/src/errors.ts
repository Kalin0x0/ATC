export class DisasterRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DisasterRuntimeError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DisasterEventNotFoundError extends DisasterRuntimeError {
  constructor(disasterId: string) {
    super(`Disaster event not found: ${disasterId}`)
    this.name = 'DisasterEventNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateDisasterNonceError extends DisasterRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate disaster nonce: ${nonce}`)
    this.name = 'DuplicateDisasterNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DisasterAlreadyContainedError extends DisasterRuntimeError {
  constructor(disasterId: string) {
    super(`Disaster already contained: ${disasterId}`)
    this.name = 'DisasterAlreadyContainedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class HazardZoneNotFoundError extends DisasterRuntimeError {
  constructor(zoneId: string) {
    super(`Hazard zone not found: ${zoneId}`)
    this.name = 'HazardZoneNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class EvacuationNotFoundError extends DisasterRuntimeError {
  constructor(evacuationId: string) {
    super(`Evacuation not found: ${evacuationId}`)
    this.name = 'EvacuationNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateEvacuationNonceError extends DisasterRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate evacuation nonce: ${nonce}`)
    this.name = 'DuplicateEvacuationNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class EmergencyResponseNotFoundError extends DisasterRuntimeError {
  constructor(responseId: string) {
    super(`Emergency response not found: ${responseId}`)
    this.name = 'EmergencyResponseNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class RecoveryRuntimeNotFoundError extends DisasterRuntimeError {
  constructor(disasterId: string) {
    super(`Recovery runtime not found: ${disasterId}`)
    this.name = 'RecoveryRuntimeNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
