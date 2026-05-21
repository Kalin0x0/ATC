export class RuntimeResilienceError extends Error {
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

export class FailoverNotFoundError extends RuntimeResilienceError {
  constructor(id: string) {
    super(`Failover not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateFailoverError extends RuntimeResilienceError {
  constructor(nonce: string) {
    super(`Duplicate failover nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class RecoverySnapshotNotFoundError extends RuntimeResilienceError {
  constructor(id: string) {
    super(`Recovery snapshot not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ChaosRuntimeNotFoundError extends RuntimeResilienceError {
  constructor(id: string) {
    super(`Chaos runtime record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ResilienceRecordNotFoundError extends RuntimeResilienceError {
  constructor(id: string) {
    super(`Resilience record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class RecoveryOperationNotFoundError extends RuntimeResilienceError {
  constructor(id: string) {
    super(`Recovery operation not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class FailoverAlreadyActiveError extends RuntimeResilienceError {
  constructor(id: string) {
    super(`Failover already active: ${id}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateChaosTestError extends RuntimeResilienceError {
  constructor(testId: string) {
    super(`Duplicate chaos test id: ${testId}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateRecoveryOperationError extends RuntimeResilienceError {
  constructor(operationId: string) {
    super(`Duplicate recovery operation id: ${operationId}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
