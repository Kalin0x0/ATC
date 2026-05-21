import type { AtcEventBus } from '@atc/events'
import type { CraftingRecipeRepository } from './crafting-recipe.repository.js'
import type { AtcCraftingRecipe, AtcRecipeType } from './crafting-recipe.repository.js'

export class CraftingRecipeService {
  constructor(
    private readonly repo: CraftingRecipeRepository,
    private readonly eventBus: AtcEventBus,
  ) {}

  async registerRecipe(params: {
    recipeId: string
    recipeName: string
    outputItemId: string
    outputQuantity: number
    recipeType: AtcRecipeType
    requiredStation?: string
    craftingTimeSeconds: number
    isDiscoverable?: boolean
  }): Promise<AtcCraftingRecipe> {
    const recipe = await this.repo.upsert(params)
    this.eventBus.emit('atc:crafting:recipe:registered', { recipeId: recipe.recipeId }).catch(() => undefined)
    return recipe
  }

  async getRecipe(recipeId: string): Promise<AtcCraftingRecipe | null> {
    return this.repo.findByRecipeId(recipeId)
  }

  async listAllRecipes(): Promise<AtcCraftingRecipe[]> {
    return this.repo.listAll()
  }

  async listActiveRecipes(): Promise<AtcCraftingRecipe[]> {
    return this.repo.listActive()
  }
}
