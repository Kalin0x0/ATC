export class MissionRuntimeError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class MissionNotFoundError extends MissionRuntimeError {
  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`, 404)
  }
}

export class DuplicateMissionNonceError extends MissionRuntimeError {
  constructor(nonce: string) {
    super(`Mission nonce already exists: ${nonce}`, 409)
  }
}

export class MissionAlreadyCompletedError extends MissionRuntimeError {
  constructor(missionId: string) {
    super(`Mission already completed: ${missionId}`, 422)
  }
}

export class ObjectiveNotFoundError extends MissionRuntimeError {
  constructor(objectiveId: string) {
    super(`Objective not found: ${objectiveId}`, 404)
  }
}

export class AssignmentAlreadyExistsError extends MissionRuntimeError {
  constructor(missionId: string, assigneeId: string) {
    super(`Assignment already exists for mission ${missionId} and assignee ${assigneeId}`, 409)
  }
}

export class AssignmentNotFoundError extends MissionRuntimeError {
  constructor(missionId: string, assigneeId: string) {
    super(`Assignment not found for mission ${missionId} and assignee ${assigneeId}`, 404)
  }
}

export class ScenarioNotFoundError extends MissionRuntimeError {
  constructor(scenarioId: string) {
    super(`Scenario not found: ${scenarioId}`, 404)
  }
}

export class DynamicEventNotFoundError extends MissionRuntimeError {
  constructor(eventId: string) {
    super(`Dynamic event not found: ${eventId}`, 404)
  }
}

export class DuplicateEventNonceError extends MissionRuntimeError {
  constructor(nonce: string) {
    super(`Dynamic event nonce already exists: ${nonce}`, 409)
  }
}
