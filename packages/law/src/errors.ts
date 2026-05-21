export class LawError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LawError'
  }
}

export class LawValidationError extends LawError {
  constructor(message: string) {
    super(message)
    this.name = 'LawValidationError'
  }
}

export class AgencyNotFoundError extends LawError {
  constructor(agencyId: string) {
    super(`Agency not found: ${agencyId}`)
    this.name = 'AgencyNotFoundError'
  }
}

export class AgencySlugConflictError extends LawError {
  constructor(slug: string) {
    super(`An agency with slug '${slug}' already exists`)
    this.name = 'AgencySlugConflictError'
  }
}

export class WarrantNotFoundError extends LawError {
  constructor(warrantId: string) {
    super(`Warrant not found: ${warrantId}`)
    this.name = 'WarrantNotFoundError'
  }
}

export class WarrantImmutableError extends LawError {
  constructor(warrantId: string, status: string) {
    super(`Warrant ${warrantId} cannot be transitioned — current status: ${status}`)
    this.name = 'WarrantImmutableError'
  }
}

export class CitationNotFoundError extends LawError {
  constructor(citationId: string) {
    super(`Citation not found: ${citationId}`)
    this.name = 'CitationNotFoundError'
  }
}

export class CitationAlreadyPaidError extends LawError {
  constructor(citationId: string) {
    super(`Citation ${citationId} has already been paid`)
    this.name = 'CitationAlreadyPaidError'
  }
}

export class CitationImmutableError extends LawError {
  constructor(citationId: string, status: string) {
    super(`Citation ${citationId} cannot be modified — current status: ${status}`)
    this.name = 'CitationImmutableError'
  }
}

export class ArrestNotFoundError extends LawError {
  constructor(arrestId: string) {
    super(`Arrest record not found: ${arrestId}`)
    this.name = 'ArrestNotFoundError'
  }
}

export class JailRecordNotFoundError extends LawError {
  constructor(jailId: string) {
    super(`Jail record not found: ${jailId}`)
    this.name = 'JailRecordNotFoundError'
  }
}

export class JailAlreadyActiveError extends LawError {
  constructor(characterId: string) {
    super(`Character ${characterId} already has an active jail record`)
    this.name = 'JailAlreadyActiveError'
  }
}

export class EvidenceNotFoundError extends LawError {
  constructor(evidenceId: string) {
    super(`Evidence record not found: ${evidenceId}`)
    this.name = 'EvidenceNotFoundError'
  }
}

export class LegalCaseNotFoundError extends LawError {
  constructor(caseId: string) {
    super(`Legal case not found: ${caseId}`)
    this.name = 'LegalCaseNotFoundError'
  }
}

export class LawMisconfiguredError extends LawError {
  constructor(reason: string) {
    super(`Law system misconfigured: ${reason}`)
    this.name = 'LawMisconfiguredError'
  }
}
