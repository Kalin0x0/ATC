export class SovereigntyRuntimeError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SovereigntyNotFoundError extends SovereigntyRuntimeError {
  constructor(id: string) {
    super(`Runtime sovereignty not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateSovereigntyError extends SovereigntyRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate sovereignty nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ClusterContinuityNotFoundError extends SovereigntyRuntimeError {
  constructor(clusterId: string) {
    super(`Cluster continuity not found: ${clusterId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class AutonomousFinalizationNotFoundError extends SovereigntyRuntimeError {
  constructor(id: string) {
    super(`Autonomous finalization not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateAutonomousFinalizationError extends SovereigntyRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate autonomous finalization nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SuccessionNotFoundError extends SovereigntyRuntimeError {
  constructor(id: string) {
    super(`Runtime succession not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateSuccessionError extends SovereigntyRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate succession nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
