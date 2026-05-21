export class RuntimeObservabilityError extends Error {
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

export class TraceNotFoundError extends RuntimeObservabilityError {
  constructor(id: string) {
    super(`Trace not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DuplicateTraceError extends RuntimeObservabilityError {
  constructor(nonce: string) {
    super(`Duplicate trace nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class CorrelationNotFoundError extends RuntimeObservabilityError {
  constructor(id: string) {
    super(`Failure correlation not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}

export class DiagnosticNotFoundError extends RuntimeObservabilityError {
  constructor(id: string) {
    super(`Diagnostic not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
  }
}
