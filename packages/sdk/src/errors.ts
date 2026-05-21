export type AtcErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'BUSINESS_RULE_VIOLATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'UNREACHABLE'

export class AtcError extends Error {
  constructor(
    public readonly code: AtcErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AtcError'
  }
}

export class AtcNotImplementedError extends AtcError {
  constructor(method: string) {
    super('NOT_IMPLEMENTED', `${method} is not implemented in Phase 1. Scheduled for Phase 2.`)
    this.name = 'AtcNotImplementedError'
  }
}

export class AtcNotFoundError extends AtcError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', id ? `${resource} with id '${id}' not found` : `${resource} not found`)
    this.name = 'AtcNotFoundError'
  }
}

export class AtcPermissionError extends AtcError {
  constructor(permission: string) {
    super('PERMISSION_DENIED', `Missing required permission: ${permission}`)
    this.name = 'AtcPermissionError'
  }
}

export class AtcValidationError extends AtcError {
  constructor(errors: string[]) {
    super('VALIDATION_ERROR', `Validation failed: ${errors.join(', ')}`, { errors })
    this.name = 'AtcValidationError'
  }
}

export class AtcBusinessRuleError extends AtcError {
  constructor(rule: string, details?: Record<string, unknown>) {
    super('BUSINESS_RULE_VIOLATION', rule, details)
    this.name = 'AtcBusinessRuleError'
  }
}
