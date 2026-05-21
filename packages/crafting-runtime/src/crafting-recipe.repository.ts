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

export class CraftingRecipeRepository {
  constructor(private readonly pool: CraftingRuntimePool) {}

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
