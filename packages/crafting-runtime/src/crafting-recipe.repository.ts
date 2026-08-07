import type { RowDataPacket } from 'mysql2/promise'
import type { CraftingRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { RecipeNotFoundError } from './errors.js'

export type AtcRecipeType = 'basic' | 'advanced' | 'industrial'

export interface AtcCraftingRecipe {
  id: string
  recipeId: string
  recipeName: string
  outputItemId: string
  outputQuantity: number
  recipeType: AtcRecipeType
  requiredStation: string | null
  craftingTimeSeconds: number
  isDiscoverable: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface RecipeRow extends RowDataPacket {
  id: string
  recipe_id: string
  recipe_name: string
  output_item_id: string
  output_quantity: number
  recipe_type: string
  required_station: string | null
  crafting_time_seconds: number
  is_discoverable: number
  is_active: number
  created_at: Date
  updated_at: Date
}

function rowToRecipe(row: RecipeRow): AtcCraftingRecipe {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    recipeName: row.recipe_name,
    outputItemId: row.output_item_id,
    outputQuantity: Number(row.output_quantity),
    recipeType: row.recipe_type as AtcRecipeType,
    requiredStation: row.required_station,
    craftingTimeSeconds: Number(row.crafting_time_seconds),
    isDiscoverable: row.is_discoverable === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** One input a recipe consumes. */
export interface AtcRecipeIngredient {
  recipeId: string
  itemId: string
  quantity: number
}

interface IngredientRow extends RowDataPacket {
  recipe_id: string
  item_id: string
  quantity: number
}

export class CraftingRecipeRepository {
  constructor(private readonly pool: CraftingRuntimePool) {}

  /** What a recipe consumes. Empty when nothing has been recorded for it. */
  async listIngredients(recipeId: string): Promise<AtcRecipeIngredient[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<IngredientRow[]>(
        `SELECT recipe_id, item_id, quantity
           FROM atc_crafting_recipe_ingredients
          WHERE recipe_id = ?
          ORDER BY item_id ASC`,
        [recipeId],
      )
      return rows.map((row) => ({
        recipeId: row.recipe_id,
        itemId: row.item_id,
        quantity: Number(row.quantity),
      }))
    } finally {
      conn.release()
    }
  }

  /**
   * Replace a recipe's ingredient list.
   *
   * Replace rather than merge: a recipe's cost is defined as a whole, and an
   * ingredient dropped from the list must disappear rather than linger. Done in
   * one transaction so a recipe is never briefly free.
   */
  async setIngredients(
    recipeId: string,
    ingredients: ReadonlyArray<{ itemId: string; quantity: number }>,
  ): Promise<AtcRecipeIngredient[]> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute(
        'DELETE FROM atc_crafting_recipe_ingredients WHERE recipe_id = ?',
        [recipeId],
      )
      for (const ing of ingredients) {
        await conn.execute(
          `INSERT INTO atc_crafting_recipe_ingredients
             (id, recipe_id, item_id, quantity)
           VALUES (?, ?, ?, ?)`,
          [generateId(), recipeId, ing.itemId, ing.quantity],
        )
      }
      await conn.commit()
      return ingredients.map((ing) => ({ recipeId, itemId: ing.itemId, quantity: ing.quantity }))
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async findByRecipeId(recipeId: string): Promise<AtcCraftingRecipe | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecipeRow[]>(
        'SELECT * FROM atc_crafting_recipes WHERE recipe_id = ? LIMIT 1',
        [recipeId],
      )
      return rows[0] ? rowToRecipe(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcCraftingRecipe[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecipeRow[]>(
        'SELECT * FROM atc_crafting_recipes ORDER BY created_at ASC',
      )
      return rows.map(rowToRecipe)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcCraftingRecipe[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecipeRow[]>(
        'SELECT * FROM atc_crafting_recipes WHERE is_active = 1 ORDER BY created_at ASC',
      )
      return rows.map(rowToRecipe)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    recipeId: string
    recipeName: string
    outputItemId: string
    outputQuantity: number
    recipeType: AtcRecipeType
    requiredStation?: string
    craftingTimeSeconds: number
    isDiscoverable?: boolean
  }): Promise<AtcCraftingRecipe> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_crafting_recipes
           (id, recipe_id, recipe_name, output_item_id, output_quantity, recipe_type,
            required_station, crafting_time_seconds, is_discoverable, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           recipe_name           = VALUES(recipe_name),
           output_item_id        = VALUES(output_item_id),
           output_quantity       = VALUES(output_quantity),
           recipe_type           = VALUES(recipe_type),
           required_station      = VALUES(required_station),
           crafting_time_seconds = VALUES(crafting_time_seconds),
           is_discoverable       = VALUES(is_discoverable),
           updated_at            = NOW(3)`,
        [
          id,
          params.recipeId,
          params.recipeName,
          params.outputItemId,
          params.outputQuantity,
          params.recipeType,
          params.requiredStation ?? null,
          params.craftingTimeSeconds,
          params.isDiscoverable !== undefined ? (params.isDiscoverable ? 1 : 0) : 1,
        ],
      )
      const [rows] = await conn.execute<RecipeRow[]>(
        'SELECT * FROM atc_crafting_recipes WHERE recipe_id = ? LIMIT 1',
        [params.recipeId],
      )
      if (!rows[0]) throw new RecipeNotFoundError(params.recipeId)
      return rowToRecipe(rows[0])
    } finally {
      conn.release()
    }
  }
}
