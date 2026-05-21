export class GlobalGovernanceRuntimeError extends Error {
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

export class GovernanceDirectiveNotFoundError extends GlobalGovernanceRuntimeError {
  constructor(id: string) {
    super(`Governance directive not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateGovernanceDirectiveError extends GlobalGovernanceRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate governance directive nonce: ${nonce}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ArbitrationNotFoundError extends GlobalGovernanceRuntimeError {
  constructor(id: string) {
    super(`Cross-system arbitration not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ConsensusNotFoundError extends GlobalGovernanceRuntimeError {
  constructor(id: string) {
    super(`Runtime consensus not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class PolicyNotFoundError extends GlobalGovernanceRuntimeError {
  constructor(id: string) {
    super(`Global policy not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class OwnershipNotFoundError extends GlobalGovernanceRuntimeError {
  constructor(id: string) {
    super(`Global ownership not found: ${id}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
