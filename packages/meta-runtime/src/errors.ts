export class MetaRuntimeError extends Error {
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

export class MetaNotFoundError extends MetaRuntimeError {
  constructor(id: string) {
    super(`Meta runtime not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateMetaError extends MetaRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate meta nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class HealingNotFoundError extends MetaRuntimeError {
  constructor(id: string) {
    super(`Healing operation not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateHealingError extends MetaRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate healing nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class RepairNotFoundError extends MetaRuntimeError {
  constructor(id: string) {
    super(`Distributed repair not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateRepairError extends MetaRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate repair nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}
