export class RuntimeLockdownError extends Error {
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

export class LockdownNotFoundError extends RuntimeLockdownError {
  constructor(id: string) {
    super(`Runtime lockdown record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateLockdownError extends RuntimeLockdownError {
  constructor(nonce: string) {
    super(`Duplicate lockdown nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ClosureNotFoundError extends RuntimeLockdownError {
  constructor(id: string) {
    super(`Deterministic closure record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateClosureError extends RuntimeLockdownError {
  constructor(nonce: string) {
    super(`Duplicate closure nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ProductionIntegrityNotFoundError extends RuntimeLockdownError {
  constructor(id: string) {
    super(`Production integrity record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SealNotFoundError extends RuntimeLockdownError {
  constructor(id: string) {
    super(`Runtime seal record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class FinalizationNotFoundError extends RuntimeLockdownError {
  constructor(id: string) {
    super(`Finalization runtime record not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateFinalizationError extends RuntimeLockdownError {
  constructor(nonce: string) {
    super(`Duplicate finalization nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
