type ErrorConstructorWithCapture = ErrorConstructor & {
  captureStackTrace?: (target: object, constructor: Function) => void
}

export class ReleaseGovernanceError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    ;(Error as ErrorConstructorWithCapture).captureStackTrace?.(this, this.constructor)
  }
}

export class ReleaseGovernanceNotFoundError extends ReleaseGovernanceError {
  constructor(id: string) { super(`Release governance not found: ${id}`, 404) }
}
export class DuplicateReleaseGovernanceError extends ReleaseGovernanceError {
  constructor(nonce: string) { super(`Duplicate release governance nonce: ${nonce}`, 409) }
}
export class ProductionDeploymentNotFoundError extends ReleaseGovernanceError {
  constructor(id: string) { super(`Production deployment not found: ${id}`, 404) }
}
export class ReleaseValidationNotFoundError extends ReleaseGovernanceError {
  constructor(id: string) { super(`Release validation not found: ${id}`, 404) }
}
export class DuplicateReleaseValidationError extends ReleaseGovernanceError {
  constructor(nonce: string) { super(`Duplicate release validation nonce: ${nonce}`, 409) }
}
export class ReleaseOrchestrationNotFoundError extends ReleaseGovernanceError {
  constructor(id: string) { super(`Release orchestration not found: ${id}`, 404) }
}
export class GlobalReleaseRuntimeNotFoundError extends ReleaseGovernanceError {
  constructor(id: string) { super(`Global release runtime not found: ${id}`, 404) }
}
export class DuplicateGlobalReleaseRuntimeError extends ReleaseGovernanceError {
  constructor(nonce: string) { super(`Duplicate global release runtime nonce: ${nonce}`, 409) }
}
