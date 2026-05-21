type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class RuntimeCertificationError extends Error {
  statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class CertificationNotFoundError extends RuntimeCertificationError {
  constructor(id: string) {
    super(`Runtime certification not found: ${id}`, 404)
  }
}

export class DuplicateCertificationError extends RuntimeCertificationError {
  constructor(nonce: string) {
    super(`Duplicate certification nonce: ${nonce}`, 409)
  }
}

export class ValidationNotFoundError extends RuntimeCertificationError {
  constructor(id: string) {
    super(`Deterministic validation not found: ${id}`, 404)
  }
}

export class DuplicateValidationError extends RuntimeCertificationError {
  constructor(nonce: string) {
    super(`Duplicate validation nonce: ${nonce}`, 409)
  }
}

export class ComplianceNotFoundError extends RuntimeCertificationError {
  constructor(id: string) {
    super(`Runtime compliance not found: ${id}`, 404)
  }
}

export class DuplicateComplianceError extends RuntimeCertificationError {
  constructor(nonce: string) {
    super(`Duplicate compliance nonce: ${nonce}`, 409)
  }
}

export class VerificationNotFoundError extends RuntimeCertificationError {
  constructor(id: string) {
    super(`Verification runtime not found: ${id}`, 404)
  }
}

export class DuplicateVerificationError extends RuntimeCertificationError {
  constructor(nonce: string) {
    super(`Duplicate verification nonce: ${nonce}`, 409)
  }
}
