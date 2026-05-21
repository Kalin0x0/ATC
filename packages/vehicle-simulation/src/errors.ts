export class VehicleSimError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VehicleSimError'
  }
}

export class FuelRecordNotFoundError extends VehicleSimError {
  constructor(vehicleRuntimeId: string) {
    super(`Fuel record not found for vehicle runtime: ${vehicleRuntimeId}`)
    this.name = 'FuelRecordNotFoundError'
  }
}

export class FuelTankEmptyError extends VehicleSimError {
  constructor(vehicleRuntimeId: string, current: number) {
    super(`Fuel tank insufficient for vehicle runtime ${vehicleRuntimeId}: current=${current}`)
    this.name = 'FuelTankEmptyError'
  }
}

export class DamageRecordNotFoundError extends VehicleSimError {
  constructor(id: string) {
    super(`Damage record not found: ${id}`)
    this.name = 'DamageRecordNotFoundError'
  }
}

export class VehicleRegistrationNotFoundError extends VehicleSimError {
  constructor(vehicleId: string) {
    super(`Vehicle registration not found for vehicle: ${vehicleId}`)
    this.name = 'VehicleRegistrationNotFoundError'
  }
}

export class VehicleRegistrationExpiredError extends VehicleSimError {
  constructor(vehicleId: string) {
    super(`Vehicle registration is expired for vehicle: ${vehicleId}`)
    this.name = 'VehicleRegistrationExpiredError'
  }
}

export class VehicleRegistrationAlreadyActiveError extends VehicleSimError {
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} already has an active registration`)
    this.name = 'VehicleRegistrationAlreadyActiveError'
  }
}

export class PursuitNotFoundError extends VehicleSimError {
  constructor(id: string) {
    super(`Pursuit not found: ${id}`)
    this.name = 'PursuitNotFoundError'
  }
}

export class PursuitAlreadyActiveError extends VehicleSimError {
  constructor(vehicleRuntimeId: string) {
    super(`Vehicle runtime ${vehicleRuntimeId} already has an active pursuit`)
    this.name = 'PursuitAlreadyActiveError'
  }
}

export class PursuitEndedError extends VehicleSimError {
  constructor(id: string) {
    super(`Pursuit ${id} has already ended`)
    this.name = 'PursuitEndedError'
  }
}

export class TrafficViolationNotFoundError extends VehicleSimError {
  constructor(id: string) {
    super(`Traffic violation not found: ${id}`)
    this.name = 'TrafficViolationNotFoundError'
  }
}

export class MetricsNotFoundError extends VehicleSimError {
  constructor(vehicleRuntimeId: string) {
    super(`Runtime metrics not found for vehicle runtime: ${vehicleRuntimeId}`)
    this.name = 'MetricsNotFoundError'
  }
}
