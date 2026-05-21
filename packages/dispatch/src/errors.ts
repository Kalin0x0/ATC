export class DispatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DispatchError'
  }
}

export class DispatchValidationError extends DispatchError {
  constructor(message: string) {
    super(message)
    this.name = 'DispatchValidationError'
  }
}

export class DispatchCallNotFoundError extends DispatchError {
  constructor(callId: string) {
    super(`Dispatch call not found: ${callId}`)
    this.name = 'DispatchCallNotFoundError'
  }
}

export class DispatchCallImmutableError extends DispatchError {
  constructor(callId: string, reason: string) {
    super(`Dispatch call ${callId} cannot be modified: ${reason}`)
    this.name = 'DispatchCallImmutableError'
  }
}

export class IncidentNotFoundError extends DispatchError {
  constructor(incidentId: string) {
    super(`Incident not found: ${incidentId}`)
    this.name = 'IncidentNotFoundError'
  }
}

export class IncidentImmutableError extends DispatchError {
  constructor(incidentId: string, status: string) {
    super(`Incident ${incidentId} cannot be transitioned — current status: ${status}`)
    this.name = 'IncidentImmutableError'
  }
}

export class ResponderAssignmentNotFoundError extends DispatchError {
  constructor(assignmentId: string) {
    super(`Responder assignment not found: ${assignmentId}`)
    this.name = 'ResponderAssignmentNotFoundError'
  }
}

export class ResponderAssignmentImmutableError extends DispatchError {
  constructor(assignmentId: string, status: string) {
    super(`Responder assignment ${assignmentId} cannot transition from: ${status}`)
    this.name = 'ResponderAssignmentImmutableError'
  }
}

export class BoloNotFoundError extends DispatchError {
  constructor(boloId: string) {
    super(`BOLO record not found: ${boloId}`)
    this.name = 'BoloNotFoundError'
  }
}

export class BoloImmutableError extends DispatchError {
  constructor(boloId: string, status: string) {
    super(`BOLO ${boloId} cannot be modified — current status: ${status}`)
    this.name = 'BoloImmutableError'
  }
}
