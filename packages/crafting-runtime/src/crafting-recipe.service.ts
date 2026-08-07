import type { AtcEventBus } from '@atc/events'
import type { CraftingRecipeRepository } from './crafting-recipe.repository.js'
import type {
  AtcCraftingRecipe,
  AtcRecipeIngredient,
  AtcRecipeType,
} from './crafting-recipe.repository.js'

/** A recipe together with what it consumes. */
export interface AtcCraftingRecipeWithIngredients extends AtcCraftingRecipe {
  ingredients: AtcRecipeIngredient[]
}

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
    /** Replaces the recipe's ingredient list when given; left alone when omitted. */
    ingredients?: ReadonlyArray<{ itemId: string; quantity: number }>
  }): Promise<AtcCraftingRecipeWithIngredients> {
    const recipe = await this.repo.upsert(params)
    if (params.ingredients !== undefined) {
      await this.repo.setIngredients(recipe.recipeId, params.ingredients)
    }
    const ingredients = await this.repo.listIngredients(recipe.recipeId)
    this.eventBus.emit('atc:crafting:recipe:registered', { recipeId: recipe.recipeId }).catch(() => undefined)
    return { ...recipe, ingredients }
  }

  async getRecipe(recipeId: string): Promise<AtcCraftingRecipe | null> {
    return this.repo.findByRecipeId(recipeId)
  }

  /** The recipe and its cost in one call — what a craft needs to decide anything. */
  async getRecipeWithIngredients(recipeId: string): Promise<AtcCraftingRecipeWithIngredients | null> {
    const recipe = await this.repo.findByRecipeId(recipeId)
    if (!recipe) return null
    const ingredients = await this.repo.listIngredients(recipeId)
    return { ...recipe, ingredients }
  }

  async listAllRecipes(): Promise<AtcCraftingRecipe[]> {
    return this.repo.listAll()
  }

  async listActiveRecipes(): Promise<AtcCraftingRecipe[]> {
    return this.repo.listActive()
  }

  /**
   * Active recipes with their ingredient lists. The crafting UI needs the cost
   * to show anything useful, and fetching it per recipe would be one request
   * per row.
   */
  async listActiveRecipesWithIngredients(): Promise<AtcCraftingRecipeWithIngredients[]> {
    const recipes = await this.repo.listActive()
    return Promise.all(
      recipes.map(async (recipe) => ({
        ...recipe,
        ingredients: await this.repo.listIngredients(recipe.recipeId),
      })),
    )
  }
}
