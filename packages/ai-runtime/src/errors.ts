export class AiRuntimeError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class AiEntityNotFoundError extends AiRuntimeError {
  constructor(entityId: string) {
    super(`AI entity not found: ${entityId}`, 404)
  }
}

export class PatrolNotFoundError extends AiRuntimeError {
  constructor(patrolId: string) {
    super(`Patrol not found: ${patrolId}`, 404)
  }
}

export class DuplicatePatrolNonceError extends AiRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate patrol nonce: ${nonce}`, 409)
  }
}

export class PatrolAlreadyActiveError extends AiRuntimeError {
  constructor(patrolId: string) {
    super(`Patrol already active: ${patrolId}`, 422)
  }
}

export class ThreatAssessmentNotFoundError extends AiRuntimeError {
  constructor(assessmentId: string) {
    super(`Threat assessment not found: ${assessmentId}`, 404)
  }
}

export class ReinforcementNotFoundError extends AiRuntimeError {
  constructor(reinforcementId: string) {
    super(`Reinforcement not found: ${reinforcementId}`, 404)
  }
}

export class DuplicateReinforcementNonceError extends AiRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate reinforcement nonce: ${nonce}`, 409)
  }
}

export class AiResponseNotFoundError extends AiRuntimeError {
  constructor(responseId: string) {
    super(`AI response not found: ${responseId}`, 404)
  }
}

export class AiResponseAlreadyActiveError extends AiRuntimeError {
  constructor(responseId: string) {
    super(`AI response already active: ${responseId}`, 422)
  }
}
