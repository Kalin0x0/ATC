export class ContinuityRuntimeError extends Error {
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

export class ContinuityNotFoundError extends ContinuityRuntimeError {
  constructor(id: string) {
    super(`Runtime continuity record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateContinuityError extends ContinuityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate continuity nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class TemporalRecoveryNotFoundError extends ContinuityRuntimeError {
  constructor(id: string) {
    super(`Temporal recovery record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class CheckpointNotFoundError extends ContinuityRuntimeError {
  constructor(id: string) {
    super(`Checkpoint runtime record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateCheckpointError extends ContinuityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate checkpoint nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class PersistenceNodeNotFoundError extends ContinuityRuntimeError {
  constructor(id: string) {
    super(`Persistence node not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class TemporalIntegrityNotFoundError extends ContinuityRuntimeError {
  constructor(id: string) {
    super(`Temporal integrity record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
