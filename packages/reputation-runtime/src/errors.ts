export class ReputationRuntimeError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ReputationRecordNotFoundError extends ReputationRuntimeError {
  constructor(principalId: string, factionId: string) {
    super(
      `Reputation record not found for principal '${principalId}' in faction '${factionId}'`,
      404,
    )
  }
}

export class DiplomaticRelationNotFoundError extends ReputationRuntimeError {
  constructor(factionAId: string, factionBId: string) {
    super(
      `Diplomatic relation not found between factions '${factionAId}' and '${factionBId}'`,
      404,
    )
  }
}

export class DuplicateDiplomaticRelationError extends ReputationRuntimeError {
  constructor(factionAId: string, factionBId: string) {
    super(
      `Diplomatic relation already exists between factions '${factionAId}' and '${factionBId}'`,
      409,
    )
  }
}

export class SocialStandingNotFoundError extends ReputationRuntimeError {
  constructor(principalId: string) {
    super(`Social standing not found for principal '${principalId}'`, 404)
  }
}

export class ReputationDecayNotFoundError extends ReputationRuntimeError {
  constructor(principalId: string, factionId: string) {
    super(
      `Reputation decay record not found for principal '${principalId}' in faction '${factionId}'`,
      404,
    )
  }
}

export class InvalidReputationScoreError extends ReputationRuntimeError {
  constructor(score: number) {
    super(`Invalid reputation score: ${score}`, 422)
  }
}
