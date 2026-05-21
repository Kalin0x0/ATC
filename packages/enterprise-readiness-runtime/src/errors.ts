type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class EnterpriseReadinessError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class EnterpriseReadinessNotFoundError extends EnterpriseReadinessError {
  constructor(id: string) { super(`Enterprise readiness not found: ${id}`, 404) }
}
export class DuplicateEnterpriseReadinessError extends EnterpriseReadinessError {
  constructor(nonce: string) { super(`Duplicate enterprise readiness nonce: ${nonce}`, 409) }
}
export class DeterministicAuditNotFoundError extends EnterpriseReadinessError {
  constructor(id: string) { super(`Deterministic audit not found: ${id}`, 404) }
}
export class DuplicateDeterministicAuditError extends EnterpriseReadinessError {
  constructor(nonce: string) { super(`Duplicate deterministic audit nonce: ${nonce}`, 409) }
}
export class IntegrityVerificationNotFoundError extends EnterpriseReadinessError {
  constructor(id: string) { super(`Integrity verification not found: ${id}`, 404) }
}
export class DuplicateIntegrityVerificationError extends EnterpriseReadinessError {
  constructor(nonce: string) { super(`Duplicate integrity verification nonce: ${nonce}`, 409) }
}
export class ProductionReadinessNotFoundError extends EnterpriseReadinessError {
  constructor(id: string) { super(`Production readiness not found: ${id}`, 404) }
}
export class DistributedAuditNotFoundError extends EnterpriseReadinessError {
  constructor(id: string) { super(`Distributed audit not found: ${id}`, 404) }
}
