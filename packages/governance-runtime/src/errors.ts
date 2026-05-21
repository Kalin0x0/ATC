export class GovernanceRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GovernanceRuntimeError'
  }
}

export class GovernanceNotFoundError extends GovernanceRuntimeError {
  constructor(id: string) {
    super(`Governance not found: ${id}`)
    this.name = 'GovernanceNotFoundError'
  }
}

export class DuplicateGovernanceError extends GovernanceRuntimeError {
  constructor(governanceId: string) {
    super(`Governance already exists: ${governanceId}`)
    this.name = 'DuplicateGovernanceError'
  }
}

export class ElectionNotFoundError extends GovernanceRuntimeError {
  constructor(id: string) {
    super(`Election not found: ${id}`)
    this.name = 'ElectionNotFoundError'
  }
}

export class DuplicateElectionError extends GovernanceRuntimeError {
  constructor(electionId: string) {
    super(`Election already exists: ${electionId}`)
    this.name = 'DuplicateElectionError'
  }
}

export class LegislationNotFoundError extends GovernanceRuntimeError {
  constructor(id: string) {
    super(`Legislation not found: ${id}`)
    this.name = 'LegislationNotFoundError'
  }
}

export class DuplicateLegislationError extends GovernanceRuntimeError {
  constructor(legislationId: string) {
    super(`Legislation already exists: ${legislationId}`)
    this.name = 'DuplicateLegislationError'
  }
}

export class PolicyNotFoundError extends GovernanceRuntimeError {
  constructor(id: string) {
    super(`Policy not found: ${id}`)
    this.name = 'PolicyNotFoundError'
  }
}

export class DuplicatePolicyError extends GovernanceRuntimeError {
  constructor(policyId: string) {
    super(`Policy already exists: ${policyId}`)
    this.name = 'DuplicatePolicyError'
  }
}
