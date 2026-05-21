export class JobsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JobsError'
  }
}

export class JobsValidationError extends JobsError {
  constructor(message: string) {
    super(message)
    this.name = 'JobsValidationError'
  }
}

export class JobNotFoundError extends JobsError {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`)
    this.name = 'JobNotFoundError'
  }
}

export class JobSlugConflictError extends JobsError {
  constructor(slug: string) {
    super(`A job with slug '${slug}' already exists`)
    this.name = 'JobSlugConflictError'
  }
}

export class JobGradeNotFoundError extends JobsError {
  constructor(gradeId: string) {
    super(`Job grade not found: ${gradeId}`)
    this.name = 'JobGradeNotFoundError'
  }
}

export class JobGradeSlugConflictError extends JobsError {
  constructor(jobId: string, slug: string) {
    super(`A grade with slug '${slug}' already exists on job ${jobId}`)
    this.name = 'JobGradeSlugConflictError'
  }
}

export class ContractNotFoundError extends JobsError {
  constructor(contractId: string) {
    super(`Employment contract not found: ${contractId}`)
    this.name = 'ContractNotFoundError'
  }
}

export class ContractAlreadyActiveError extends JobsError {
  constructor(characterId: string, organizationId: string | null) {
    const scope = organizationId ? `organization ${organizationId}` : 'this job'
    super(`Character ${characterId} already has an active contract for ${scope}`)
    this.name = 'ContractAlreadyActiveError'
  }
}

export class ContractNotActiveError extends JobsError {
  constructor(contractId: string, status: string) {
    super(`Contract ${contractId} is not active: status=${status}`)
    this.name = 'ContractNotActiveError'
  }
}

export class ContractImmutableError extends JobsError {
  constructor(contractId: string) {
    super(`Contract ${contractId} is terminated and cannot be modified`)
    this.name = 'ContractImmutableError'
  }
}

export class WorkSessionNotFoundError extends JobsError {
  constructor(sessionId: string) {
    super(`Work session not found: ${sessionId}`)
    this.name = 'WorkSessionNotFoundError'
  }
}

export class AlreadyClockedInError extends JobsError {
  constructor(characterId: string) {
    super(`Character ${characterId} already has an active work session`)
    this.name = 'AlreadyClockedInError'
  }
}

export class NotClockedInError extends JobsError {
  constructor(characterId: string) {
    super(`Character ${characterId} has no active work session to clock out of`)
    this.name = 'NotClockedInError'
  }
}

export class PayrollRunNotFoundError extends JobsError {
  constructor(runId: string) {
    super(`Payroll run not found: ${runId}`)
    this.name = 'PayrollRunNotFoundError'
  }
}

export class PayrollAlreadyCommittedError extends JobsError {
  constructor(runId: string) {
    super(`Payroll run ${runId} has already been committed`)
    this.name = 'PayrollAlreadyCommittedError'
  }
}

export class PayrollInsufficientFundsError extends JobsError {
  constructor(organizationId: string, required: number, currency: string) {
    super(`Organization ${organizationId} has insufficient funds for payroll: required ${required} ${currency}`)
    this.name = 'PayrollInsufficientFundsError'
  }
}

export class JobsMisconfiguredError extends JobsError {
  constructor(reason: string) {
    super(`Jobs system misconfigured: ${reason}`)
    this.name = 'JobsMisconfiguredError'
  }
}
