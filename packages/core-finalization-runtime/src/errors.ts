export class CoreFinalizationError extends Error {
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

export class FinalizationNotFoundError extends CoreFinalizationError {
  constructor(id: string) {
    super(`Core finalization not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateFinalizationError extends CoreFinalizationError {
  constructor(nonce: string) {
    super(`Duplicate core finalization nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class CompletionNotFoundError extends CoreFinalizationError {
  constructor(id: string) {
    super(`Runtime completion not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateCompletionError extends CoreFinalizationError {
  constructor(nonce: string) {
    super(`Duplicate runtime completion nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ProductionSealNotFoundError extends CoreFinalizationError {
  constructor(id: string) {
    super(`Production seal not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateProductionSealError extends CoreFinalizationError {
  constructor(nonce: string) {
    super(`Duplicate production seal nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DeterministicSealingNotFoundError extends CoreFinalizationError {
  constructor(id: string) {
    super(`Deterministic sealing not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateDeterministicSealingError extends CoreFinalizationError {
  constructor(nonce: string) {
    super(`Duplicate deterministic sealing nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
