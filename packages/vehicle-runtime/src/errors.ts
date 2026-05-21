export class VehicleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleError'
  }
}

export class VehicleValidationError extends VehicleError {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleValidationError'
  }
}

export class VehicleNotFoundError extends VehicleError {
  constructor(id: string) {
    super(`Vehicle not found: ${id}`)
    this.name = 'VehicleNotFoundError'
  }
}

export class VehicleImmutableError extends VehicleError {
  constructor(id: string, currentStatus: string, targetStatus: string) {
    super(`Cannot transition vehicle ${id} from '${currentStatus}' to '${targetStatus}'`)
    this.name = 'VehicleImmutableError'
  }
}

export class VehicleAlreadySpawnedError extends VehicleError {
  constructor(id: string) {
    super(`Vehicle ${id} is already spawned — despawn before re-spawning`)
    this.name = 'VehicleAlreadySpawnedError'
  }
}

export class VehicleAlreadyStoredError extends VehicleError {
  constructor(id: string) {
    super(`Vehicle ${id} is already stored in a garage`)
    this.name = 'VehicleAlreadyStoredError'
  }
}

export class VehicleAlreadyImpoundedError extends VehicleError {
  constructor(id: string) {
    super(`Vehicle ${id} is already impounded`)
    this.name = 'VehicleAlreadyImpoundedError'
  }
}

export class GarageCapacityError extends VehicleError {
  constructor(garageId: string) {
    super(`Garage ${garageId} is at capacity`)
    this.name = 'GarageCapacityError'
  }
}

export class GarageVehicleNotFoundError extends VehicleError {
  constructor(vehicleId: string, garageId: string) {
    super(`Vehicle ${vehicleId} is not stored in garage ${garageId}`)
    this.name = 'GarageVehicleNotFoundError'
  }
}

export class ImpoundNotFoundError extends VehicleError {
  constructor(vehicleId: string) {
    super(`No active impound found for vehicle ${vehicleId}`)
    this.name = 'ImpoundNotFoundError'
  }
}

export class EvidenceHoldError extends VehicleError {
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} is on evidence hold and cannot be released`)
    this.name = 'EvidenceHoldError'
  }
}

export class FleetAssignmentConflictError extends VehicleError {
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} already has an active fleet assignment`)
    this.name = 'FleetAssignmentConflictError'
  }
}

export class FleetAssignmentNotFoundError extends VehicleError {
  constructor(assignmentId: string) {
    super(`Fleet assignment not found: ${assignmentId}`)
    this.name = 'FleetAssignmentNotFoundError'
  }
}
