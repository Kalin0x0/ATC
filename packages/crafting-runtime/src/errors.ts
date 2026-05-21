export class CraftingRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CraftingRuntimeError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class RecipeNotFoundError extends CraftingRuntimeError {
  constructor(recipeId: string) {
    super(`Recipe not found: ${recipeId}`)
    this.name = 'RecipeNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class RecipeAlreadyExistsError extends CraftingRuntimeError {
  constructor(recipeId: string) {
    super(`Recipe already exists: ${recipeId}`)
    this.name = 'RecipeAlreadyExistsError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class BlueprintNotFoundError extends CraftingRuntimeError {
  constructor(blueprintId: string) {
    super(`Blueprint not found: ${blueprintId}`)
    this.name = 'BlueprintNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class BlueprintAlreadyOwnedError extends CraftingRuntimeError {
  constructor(principalId: string, recipeId: string) {
    super(`Principal ${principalId} already owns blueprint for ${recipeId}`)
    this.name = 'BlueprintAlreadyOwnedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ManufacturingQueueNotFoundError extends CraftingRuntimeError {
  constructor(stationId: string) {
    super(`Manufacturing queue not found for station: ${stationId}`)
    this.name = 'ManufacturingQueueNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ManufacturingQueueOfflineError extends CraftingRuntimeError {
  constructor(stationId: string) {
    super(`Manufacturing queue is offline for station: ${stationId}`)
    this.name = 'ManufacturingQueueOfflineError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ProductionJobNotFoundError extends CraftingRuntimeError {
  constructor(jobId: string) {
    super(`Production job not found: ${jobId}`)
    this.name = 'ProductionJobNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ProductionJobAlreadyActiveError extends CraftingRuntimeError {
  constructor(stationId: string) {
    super(`Station ${stationId} already has an active job`)
    this.name = 'ProductionJobAlreadyActiveError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class DuplicateJobNonceError extends CraftingRuntimeError {
  constructor(nonce: string) {
    super(`Duplicate job nonce: ${nonce}`)
    this.name = 'DuplicateJobNonceError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ProductionJobNotActiveError extends CraftingRuntimeError {
  constructor(jobId: string) {
    super(`Production job is not active: ${jobId}`)
    this.name = 'ProductionJobNotActiveError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
