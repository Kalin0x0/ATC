type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class RuntimeSustainmentError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class SustainmentNotFoundError extends RuntimeSustainmentError {
  constructor(id: string) { super(`Runtime sustainment not found: ${id}`, 404) }
}
export class DuplicateSustainmentError extends RuntimeSustainmentError {
  constructor(nonce: string) { super(`Duplicate sustainment nonce: ${nonce}`, 409) }
}
export class RecoveryNotFoundError extends RuntimeSustainmentError {
  constructor(id: string) { super(`Recovery not found: ${id}`, 404) }
}
export class MaintenanceNotFoundError extends RuntimeSustainmentError {
  constructor(id: string) { super(`Autonomous maintenance not found: ${id}`, 404) }
}
export class DuplicateMaintenanceError extends RuntimeSustainmentError {
  constructor(nonce: string) { super(`Duplicate maintenance nonce: ${nonce}`, 409) }
}
export class SustainmentNodeNotFoundError extends RuntimeSustainmentError {
  constructor(id: string) { super(`Sustainment node not found: ${id}`, 404) }
}
export class LongevityNotFoundError extends RuntimeSustainmentError {
  constructor(id: string) { super(`Runtime longevity not found: ${id}`, 404) }
}
export class DuplicateLongevityError extends RuntimeSustainmentError {
  constructor(nonce: string) { super(`Duplicate longevity nonce: ${nonce}`, 409) }
}
