import type { AtcEventBus } from '@atc/events'
import type { CraftingBlueprintRepository } from './crafting-blueprint.repository.js'
import type { CraftingRecipeRepository } from './crafting-recipe.repository.js'
import type { AtcCraftingBlueprint } from './crafting-blueprint.repository.js'
import {
  RecipeNotFoundError,
  BlueprintAlreadyOwnedError,
} from './errors.js'

export class BlueprintService {
  constructor(
    private readonly blueprintRepo: CraftingBlueprintRepository,
    private readonly recipeRepo: CraftingRecipeRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async acquireBlueprint(
    principalId: string,
    recipeId: string,
    source: string,
  ): Promise<AtcCraftingBlueprint> {
    const recipe = await this.recipeRepo.findByRecipeId(recipeId)
    if (!recipe) throw new RecipeNotFoundError(recipeId)

    const existing = await this.blueprintRepo.findByPrincipalAndRecipe(principalId, recipeId)
    if (existing) throw new BlueprintAlreadyOwnedError(principalId, recipeId)

    const blueprint = await this.blueprintRepo.create(principalId, recipeId, source)
    this.eventBus.emit('atc:crafting:blueprint:acquired', { principalId, recipeId }).catch(() => undefined)
    return blueprint
  }

  async listBlueprints(principalId: string): Promise<AtcCraftingBlueprint[]> {
    return this.blueprintRepo.listByPrincipal(principalId)
  }

  async hasBlueprint(principalId: string, recipeId: string): Promise<boolean> {
    const bp = await this.blueprintRepo.findByPrincipalAndRecipe(principalId, recipeId)
    return bp !== null
  }
}
