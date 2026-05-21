export class WorldOrchestratorError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 500) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class WorldRegionNotFoundError extends WorldOrchestratorError {
  readonly regionId: string

  constructor(regionId: string) {
    super(`World region not found: ${regionId}`, 404)
    this.name = this.constructor.name
    this.regionId = regionId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateWorldRegionError extends WorldOrchestratorError {
  readonly regionId: string

  constructor(regionId: string) {
    super(`World region already exists: ${regionId}`, 409)
    this.name = this.constructor.name
    this.regionId = regionId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class RuntimeAllocationNotFoundError extends WorldOrchestratorError {
  readonly allocationId: string

  constructor(allocationId: string) {
    super(`Runtime allocation not found: ${allocationId}`, 404)
    this.name = this.constructor.name
    this.allocationId = allocationId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ShardRuntimeNotFoundError extends WorldOrchestratorError {
  readonly shardId: string

  constructor(shardId: string) {
    super(`Shard runtime not found: ${shardId}`, 404)
    this.name = this.constructor.name
    this.shardId = shardId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class DuplicateShardError extends WorldOrchestratorError {
  readonly shardId: string

  constructor(shardId: string) {
    super(`Shard already exists: ${shardId}`, 409)
    this.name = this.constructor.name
    this.shardId = shardId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class RegionalSimulationNotFoundError extends WorldOrchestratorError {
  readonly regionId: string

  constructor(regionId: string) {
    super(`Regional simulation not found for region: ${regionId}`, 404)
    this.name = this.constructor.name
    this.regionId = regionId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class StaleShardError extends WorldOrchestratorError {
  readonly shardId: string

  constructor(shardId: string) {
    super(`Shard is stale and cannot be updated: ${shardId}`, 422)
    this.name = this.constructor.name
    this.shardId = shardId
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
