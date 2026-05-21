export class EvolutionRuntimeError extends Error {
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

export class EvolutionRuntimeNotFoundError extends EvolutionRuntimeError {
  constructor(id: string) {
    super(`Runtime evolution not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateEvolutionRuntimeError extends EvolutionRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate evolution runtime nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class OptimizationNotFoundError extends EvolutionRuntimeError {
  constructor(id: string) {
    super(`Adaptive optimization not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateOptimizationError extends EvolutionRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate optimization nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class AutonomousEvolutionNotFoundError extends EvolutionRuntimeError {
  constructor(id: string) {
    super(`Autonomous evolution not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateAutonomousEvolutionError extends EvolutionRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate autonomous evolution nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}
