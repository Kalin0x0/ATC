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

export class RecipeInactiveError extends CraftingRuntimeError {
  constructor(recipeId: string) {
    super(`Recipe is not active: ${recipeId}`)
    this.name = 'RecipeInactiveError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * A recipe with no ingredient rows. Crafting it would grant the output for
 * nothing, so it is refused rather than treated as free — an empty list far
 * more often means the recipe was never given a cost than that it has none.
 */
export class RecipeHasNoIngredientsError extends CraftingRuntimeError {
  constructor(recipeId: string) {
    super(`Recipe has no ingredients recorded, so it cannot be crafted: ${recipeId}`)
    this.name = 'RecipeHasNoIngredientsError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * The recipe is tied to a manufacturing station, which an instant craft cannot
 * verify the character is standing at. Use the production-job flow instead.
 */
export class RecipeRequiresStationError extends CraftingRuntimeError {
  constructor(recipeId: string, station: string) {
    super(`Recipe ${recipeId} requires station '${station}' — craft it through /api/v1/crafting/jobs`)
    this.name = 'RecipeRequiresStationError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InsufficientMaterialsError extends CraftingRuntimeError {
  constructor(
    recipeId: string,
    readonly missing: ReadonlyArray<{ itemId: string; required: number; held: number }>,
  ) {
    super(
      `Insufficient materials for ${recipeId}: ` +
      missing.map((m) => `${m.itemId} ${m.held}/${m.required}`).join(', '),
    )
    this.name = 'InsufficientMaterialsError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Ingredients were consumed but the output could not be granted, and putting
 * the ingredients back failed as well. The character has lost materials — this
 * is the one crafting failure that needs a human to look at it, which is why it
 * is a distinct error and not folded into a generic 500.
 */
export class CraftCompensationFailedError extends CraftingRuntimeError {
  constructor(
    recipeId: string,
    readonly characterId: string,
    readonly craftNonce: string,
    readonly unreturned: ReadonlyArray<{ itemId: string; quantity: number }>,
  ) {
    super(
      `Craft of ${recipeId} failed and materials could not be returned to ${characterId} ` +
      `(nonce ${craftNonce}): ` +
      unreturned.map((u) => `${u.itemId} x${u.quantity}`).join(', '),
    )
    this.name = 'CraftCompensationFailedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * The craft nonce has been used by an attempt that did not complete — its
 * ingredients were taken and put back.
 *
 * Retrying under the same nonce would replay the removals as no-ops (they are
 * idempotent, and already recorded) while granting the output for real, which
 * would hand out a free item. A fresh nonce is required.
 */
export class CraftNonceConsumedError extends CraftingRuntimeError {
  constructor(craftNonce: string) {
    super(`Craft nonce already used by a failed attempt, use a new one: ${craftNonce}`)
    this.name = 'CraftNonceConsumedError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
