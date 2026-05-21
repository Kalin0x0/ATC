export class CityRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CityRuntimeError'
  }
}

export class UtilityGridNotFoundError extends CityRuntimeError {
  constructor(id: string) {
    super(`Utility grid not found: ${id}`)
    this.name = 'UtilityGridNotFoundError'
  }
}

export class UtilityGridAlreadyDownError extends CityRuntimeError {
  constructor(id: string) {
    super(`Utility grid already offline: ${id}`)
    this.name = 'UtilityGridAlreadyDownError'
  }
}

export class UtilityGridAlreadyRestoredError extends CityRuntimeError {
  constructor(id: string) {
    super(`Utility grid already online: ${id}`)
    this.name = 'UtilityGridAlreadyRestoredError'
  }
}

export class TrafficSignalNotFoundError extends CityRuntimeError {
  constructor(id: string) {
    super(`Traffic signal not found: ${id}`)
    this.name = 'TrafficSignalNotFoundError'
  }
}

export class InfrastructureNotFoundError extends CityRuntimeError {
  constructor(id: string) {
    super(`Infrastructure node not found: ${id}`)
    this.name = 'InfrastructureNotFoundError'
  }
}

export class InfrastructureFailureNotFoundError extends CityRuntimeError {
  constructor(id: string) {
    super(`Infrastructure failure not found: ${id}`)
    this.name = 'InfrastructureFailureNotFoundError'
  }
}

export class InfrastructureAlreadyRecoveredError extends CityRuntimeError {
  constructor(id: string) {
    super(`Infrastructure already recovered: ${id}`)
    this.name = 'InfrastructureAlreadyRecoveredError'
  }
}

export class EnvironmentRuntimeNotFoundError extends CityRuntimeError {
  constructor(id: string) {
    super(`Environment runtime not found: ${id}`)
    this.name = 'EnvironmentRuntimeNotFoundError'
  }
}

export class DuplicateOutageError extends CityRuntimeError {
  constructor(key: string) {
    super(`Duplicate outage nonce: ${key}`)
    this.name = 'DuplicateOutageError'
  }
}
