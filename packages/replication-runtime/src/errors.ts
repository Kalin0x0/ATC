export class ReplicationRuntimeError extends Error {
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

export class SpatialOwnershipNotFoundError extends ReplicationRuntimeError {
  constructor(entityId: string) {
    super(`Spatial ownership not found for entity: ${entityId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateSpatialOwnershipError extends ReplicationRuntimeError {
  constructor(entityId: string) {
    super(`Duplicate spatial ownership for entity: ${entityId}`, 409)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SpatialNodeNotFoundError extends ReplicationRuntimeError {
  constructor(nodeId: string) {
    super(`Spatial node not found: ${nodeId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class SnapshotNotFoundError extends ReplicationRuntimeError {
  constructor(snapshotId: string) {
    super(`Runtime snapshot not found: ${snapshotId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class InterestRegionNotFoundError extends ReplicationRuntimeError {
  constructor(regionId: string) {
    super(`Interest region not found: ${regionId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class StreamingRuntimeNotFoundError extends ReplicationRuntimeError {
  constructor(entityId: string) {
    super(`Streaming runtime not found for entity: ${entityId}`, 404)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class StaleOwnershipError extends ReplicationRuntimeError {
  constructor(entityId: string) {
    super(`Stale ownership detected for entity: ${entityId}`, 422)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
