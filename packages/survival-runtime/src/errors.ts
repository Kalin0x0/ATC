export class SurvivalRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SurvivalRuntimeError'
  }
}

export class SurvivalStateNotFoundError extends SurvivalRuntimeError {
  constructor(principalId: string) {
    super(`Survival state not found for principal: ${principalId}`)
    this.name = 'SurvivalStateNotFoundError'
  }
}

export class TemperatureStateNotFoundError extends SurvivalRuntimeError {
  constructor(principalId: string) {
    super(`Temperature state not found for principal: ${principalId}`)
    this.name = 'TemperatureStateNotFoundError'
  }
}

export class HydrationStateNotFoundError extends SurvivalRuntimeError {
  constructor(principalId: string) {
    super(`Hydration state not found for principal: ${principalId}`)
    this.name = 'HydrationStateNotFoundError'
  }
}

export class FatigueStateNotFoundError extends SurvivalRuntimeError {
  constructor(principalId: string) {
    super(`Fatigue state not found for principal: ${principalId}`)
    this.name = 'FatigueStateNotFoundError'
  }
}

export class EnvironmentalHazardNotFoundError extends SurvivalRuntimeError {
  constructor(hazardId: string) {
    super(`Environmental hazard not found: ${hazardId}`)
    this.name = 'EnvironmentalHazardNotFoundError'
  }
}

export class HazardAlreadyActiveError extends SurvivalRuntimeError {
  constructor(hazardId: string) {
    super(`Hazard already active: ${hazardId}`)
    this.name = 'HazardAlreadyActiveError'
  }
}

export class ExposureConflictError extends SurvivalRuntimeError {
  constructor(principalId: string, hazardId: string) {
    super(`Exposure conflict for principal ${principalId} on hazard ${hazardId}`)
    this.name = 'ExposureConflictError'
  }
}
