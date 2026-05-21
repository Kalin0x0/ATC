export class SecurityRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityRuntimeError'
  }
}

export class IntrusionNotFoundError extends SecurityRuntimeError {
  constructor(id: string) {
    super(`Intrusion not found: ${id}`)
  }
}

export class DuplicateIntrusionError extends SecurityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate intrusion nonce: ${nonce}`)
  }
}

export class ThreatNotFoundError extends SecurityRuntimeError {
  constructor(id: string) {
    super(`Runtime threat not found: ${id}`)
  }
}

export class DuplicateThreatError extends SecurityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate threat nonce: ${nonce}`)
  }
}

export class EscalationNotFoundError extends SecurityRuntimeError {
  constructor(id: string) {
    super(`Security escalation not found: ${id}`)
  }
}

export class DuplicateEscalationError extends SecurityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate escalation nonce: ${nonce}`)
  }
}

export class ContainmentNotFoundError extends SecurityRuntimeError {
  constructor(id: string) {
    super(`Threat containment not found: ${id}`)
  }
}

export class DuplicateContainmentError extends SecurityRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate containment nonce: ${nonce}`)
  }
}
