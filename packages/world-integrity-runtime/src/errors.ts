export class WorldIntegrityRuntimeError extends Error {
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

export class IntegrityNotFoundError extends WorldIntegrityRuntimeError {
  constructor(id: string) {
    super(`World integrity record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateIntegrityError extends WorldIntegrityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate integrity nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class LockNotFoundError extends WorldIntegrityRuntimeError {
  constructor(resourceKey: string) {
    super(`Distributed lock not found: ${resourceKey}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ConsistencyNotFoundError extends WorldIntegrityRuntimeError {
  constructor(nodeId: string) {
    super(`Runtime consistency record not found: ${nodeId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ValidationNotFoundError extends WorldIntegrityRuntimeError {
  constructor(id: string) {
    super(`Integrity validation record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateValidationError extends WorldIntegrityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate validation nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ReconciliationNotFoundError extends WorldIntegrityRuntimeError {
  constructor(id: string) {
    super(`World reconciliation record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateReconciliationError extends WorldIntegrityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate reconciliation nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
