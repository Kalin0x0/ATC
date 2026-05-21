export class TransportRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransportRuntimeError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class VesselNotFoundError extends TransportRuntimeError {
  constructor(public readonly vesselId: string) {
    super(`Vessel not found: ${vesselId}`)
    this.name = 'VesselNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class VesselAlreadyDockedError extends TransportRuntimeError {
  constructor(public readonly vesselId: string) {
    super(`Vessel already docked: ${vesselId}`)
    this.name = 'VesselAlreadyDockedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AircraftNotFoundError extends TransportRuntimeError {
  constructor(public readonly aircraftId: string) {
    super(`Aircraft not found: ${aircraftId}`)
    this.name = 'AircraftNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AircraftAlreadyAirborneError extends TransportRuntimeError {
  constructor(public readonly aircraftId: string) {
    super(`Aircraft already airborne: ${aircraftId}`)
    this.name = 'AircraftAlreadyAirborneError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class FlightNotFoundError extends TransportRuntimeError {
  constructor(public readonly flightId: string) {
    super(`Flight not found: ${flightId}`)
    this.name = 'FlightNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateFlightNonceError extends TransportRuntimeError {
  constructor(public readonly nonce: string) {
    super(`Duplicate flight nonce: ${nonce}`)
    this.name = 'DuplicateFlightNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AirspaceZoneNotFoundError extends TransportRuntimeError {
  constructor(public readonly zoneId: string) {
    super(`Airspace zone not found: ${zoneId}`)
    this.name = 'AirspaceZoneNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DockingSlotNotFoundError extends TransportRuntimeError {
  constructor(public readonly slotId: string) {
    super(`Docking slot not found: ${slotId}`)
    this.name = 'DockingSlotNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateDockingNonceError extends TransportRuntimeError {
  constructor(public readonly nonce: string) {
    super(`Duplicate docking nonce: ${nonce}`)
    this.name = 'DuplicateDockingNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
