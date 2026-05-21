import type { RowDataPacket } from 'mysql2/promise'
import type { CraftingRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { BlueprintNotFoundError } from './errors.js'

export interface AtcCraftingBlueprint {
  id: string
  blueprintId: string
  principalId: string
  recipeId: string
  source: string
  acquiredAt: Date
  createdAt: Date
  updatedAt: Date
}

interface BlueprintRow extends RowDataPacket {
  id: string
  blueprint_id: string
  principal_id: string
  recipe_id: string
  source: string
  acquired_at: Date
  created_at: Date
  updated_at: Date
}

function rowToBlueprint(row: BlueprintRow): AtcCraftingBlueprint {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    principalId: row.principal_id,
    recipeId: row.recipe_id,
    source: row.source,
    acquiredAt: row.acquired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CraftingBlueprintRepository {
  constructor(private readonly pool: CraftingRuntimePool) {}

  async findById(blueprintId: string): Promise<AtcCraftingBlueprint | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BlueprintRow[]>(
        'SELECT * FROM atc_crafting_blueprints WHERE blueprint_id = ? LIMIT 1',
        [blueprintId],
      )
      return rows[0] ? rowToBlueprint(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByPrincipalAndRecipe(
    principalId: string,
    recipeId: string,
  ): Promise<AtcCraftingBlueprint | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BlueprintRow[]>(
        'SELECT * FROM atc_crafting_blueprints WHERE principal_id = ? AND recipe_id = ? LIMIT 1',
        [principalId, recipeId],
      )
      return rows[0] ? rowToBlueprint(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByPrincipal(principalId: string): Promise<AtcCraftingBlueprint[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BlueprintRow[]>(
        'SELECT * FROM atc_crafting_blueprints WHERE principal_id = ? ORDER BY acquired_at DESC',
        [principalId],
      )
      return rows.map(rowToBlueprint)
    } finally {
      conn.release()
    }
  }

  async create(
    principalId: string,
    recipeId: string,
    source: string,
  ): Promise<AtcCraftingBlueprint> {
    const id = generateId()
    const blueprintId = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_crafting_blueprints
           (id, blueprint_id, principal_id, recipe_id, source, acquired_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
        [id, blueprintId, principalId, recipeId, source],
      )
      const [rows] = await conn.execute<BlueprintRow[]>(
        'SELECT * FROM atc_crafting_blueprints WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new BlueprintNotFoundError(blueprintId)
      return rowToBlueprint(rows[0])
    } finally {
      conn.release()
    }
  }
}
