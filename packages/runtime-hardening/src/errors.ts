type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class RuntimeHardeningError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class HardeningNotFoundError extends RuntimeHardeningError {
  constructor(id: string) { super(`Runtime hardening not found: ${id}`, 404) }
}
export class DuplicateHardeningError extends RuntimeHardeningError {
  constructor(nonce: string) { super(`Duplicate hardening nonce: ${nonce}`, 409) }
}
export class ImmutableSecurityNotFoundError extends RuntimeHardeningError {
  constructor(id: string) { super(`Immutable security not found: ${id}`, 404) }
}
export class DuplicateImmutableSecurityError extends RuntimeHardeningError {
  constructor(nonce: string) { super(`Duplicate security nonce: ${nonce}`, 409) }
}
export class SecurityValidationNotFoundError extends RuntimeHardeningError {
  constructor(id: string) { super(`Security validation not found: ${id}`, 404) }
}
export class DuplicateSecurityValidationError extends RuntimeHardeningError {
  constructor(nonce: string) { super(`Duplicate validation nonce: ${nonce}`, 409) }
}
export class SealValidationNotFoundError extends RuntimeHardeningError {
  constructor(id: string) { super(`Seal validation not found: ${id}`, 404) }
}
export class DuplicateSealValidationError extends RuntimeHardeningError {
  constructor(nonce: string) { super(`Duplicate seal validation nonce: ${nonce}`, 409) }
}
export class ThreatMitigationNotFoundError extends RuntimeHardeningError {
  constructor(id: string) { super(`Threat mitigation not found: ${id}`, 404) }
}
export class DuplicateThreatMitigationError extends RuntimeHardeningError {
  constructor(nonce: string) { super(`Duplicate mitigation nonce: ${nonce}`, 409) }
}
