import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import type {
  AtcItemDefinition,
  AtcItemDefinitionStatus,
  AtcItemCatalogQuery,
  AtcItemActionConfig,
} from '@atc/shared-types'

// ── Custom errors ─────────────────────────────────────────────────────────────

export class ItemDefinitionDuplicateError extends Error {
  constructor(id: string) {
    super(`Item definition '${id}' already exists`)
    this.name = 'ItemDefinitionDuplicateError'
  }
}

export class ItemDefinitionNotFoundError extends Error {
  constructor(id: string) {
    super(`Item definition '${id}' not found`)
    this.name = 'ItemDefinitionNotFoundError'
  }
}

// ── Param interfaces ──────────────────────────────────────────────────────────

export interface UpsertItemDefinitionParams {
  id: string
  label: string
  description?: string
  category: string
  stackable?: boolean
  maxStack?: number
  weightGrams?: number
  usable?: boolean
  tradable?: boolean
  metadataSchema?: Record<string, unknown>
  status?: AtcItemDefinitionStatus
  imageUrl?: string
  icon?: string
  tags?: string[]
  sortOrder?: number
  actionConfig?: AtcItemActionConfig
}

export type CreateItemDefinitionParams = UpsertItemDefinitionParams

export interface UpdateItemDefinitionParams {
  label?: string
  description?: string | null
  category?: string
  stackable?: boolean
  maxStack?: number
  weightGrams?: number
  usable?: boolean
  tradable?: boolean
  metadataSchema?: Record<string, unknown> | null
  imageUrl?: string | null
  icon?: string | null
  tags?: string[]
  sortOrder?: number
  actionConfig?: AtcItemActionConfig | null
}

// ── DB row shape ──────────────────────────────────────────────────────────────

interface ItemDefinitionRow extends RowDataPacket {
  id: string
  label: string
  description: string | null
  category: string
  stackable: number
  max_stack: number
  weight_grams: number
  usable: number
  tradable: number
  metadata_schema_json: string | null
  status: string
  image_url: string | null
  icon: string | null
  tags_json: string | null
  sort_order: number
  version: number
  action_config_json: string | null
  created_at: Date
  updated_at: Date
}

interface UsageCountRow extends RowDataPacket {
  usage_count: number
}

// ── Row mapper ────────────────────────────────────────────────────────────────

function rowToItemDefinition(row: ItemDefinitionRow): AtcItemDefinition {
  let tags: string[] = []
  if (row.tags_json) {
    try {
      const parsed = JSON.parse(row.tags_json)
      tags = Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      tags = []
    }
  }

  let actionConfig: AtcItemActionConfig | null = null
  if (row.action_config_json) {
    try {
      actionConfig = JSON.parse(row.action_config_json) as AtcItemActionConfig
    } catch {
      actionConfig = null
    }
  }

  return {
    id: row.id,
    label: row.label,
    description: row.description,
    category: row.category,
    stackable: row.stackable === 1,
    maxStack: row.max_stack,
    weightGrams: row.weight_grams,
    usable: row.usable === 1,
    tradable: row.tradable === 1,
    metadataSchema: row.metadata_schema_json ? JSON.parse(row.metadata_schema_json) : null,
    status: row.status as AtcItemDefinitionStatus,
    imageUrl: row.image_url ?? null,
    icon: row.icon ?? null,
    tags,
    sortOrder: row.sort_order ?? 0,
    version: row.version ?? 1,
    actionConfig,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

export class ItemDefinitionRepository {
  constructor(private readonly pool: DbPool) {}

  // ── Legacy upsert (backward-compatible — no version increment) ────────────

  async upsert(params: UpsertItemDefinitionParams): Promise<AtcItemDefinition> {
    const {
      id,
      label,
      description = null,
      category,
      stackable = true,
      maxStack = 100,
      weightGrams = 0,
      usable = false,
      tradable = true,
      metadataSchema,
      status = 'active',
      imageUrl = null,
      icon = null,
      tags = [],
      sortOrder = 0,
      actionConfig,
    } = params

    const metaJson = metadataSchema !== undefined ? JSON.stringify(metadataSchema) : null
    const tagsJson = JSON.stringify(tags)
    const actionConfigJson = actionConfig !== undefined ? JSON.stringify(actionConfig) : null

    await this.pool.execute(
      `INSERT INTO atc_item_definitions
         (id, label, description, category, stackable, max_stack, weight_grams, usable, tradable,
          metadata_schema_json, status, image_url, icon, tags_json, sort_order, action_config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label                = VALUES(label),
         description          = VALUES(description),
         category             = VALUES(category),
         stackable            = VALUES(stackable),
         max_stack            = VALUES(max_stack),
         weight_grams         = VALUES(weight_grams),
         usable               = VALUES(usable),
         tradable             = VALUES(tradable),
         metadata_schema_json = VALUES(metadata_schema_json),
         status               = VALUES(status),
         image_url            = VALUES(image_url),
         icon                 = VALUES(icon),
         tags_json            = VALUES(tags_json),
         sort_order           = VALUES(sort_order),
         action_config_json   = VALUES(action_config_json)`,
      [id, label, description, category, stackable ? 1 : 0, maxStack, weightGrams,
       usable ? 1 : 0, tradable ? 1 : 0, metaJson, status, imageUrl, icon, tagsJson, sortOrder,
       actionConfigJson],
    )

    const row = await this.findById(id)
    if (!row) throw new Error(`ItemDefinition not found after upsert: ${id}`)
    return row
  }

  // ── Phase 7: create (INSERT only — throws ItemDefinitionDuplicateError) ───

  async create(params: CreateItemDefinitionParams): Promise<AtcItemDefinition> {
    const {
      id,
      label,
      description = null,
      category,
      stackable = true,
      maxStack = 100,
      weightGrams = 0,
      usable = false,
      tradable = true,
      metadataSchema,
      status = 'active',
      imageUrl = null,
      icon = null,
      tags = [],
      sortOrder = 0,
      actionConfig,
    } = params

    const metaJson = metadataSchema !== undefined ? JSON.stringify(metadataSchema) : null
    const tagsJson = JSON.stringify(tags)
    const actionConfigJson = actionConfig !== undefined ? JSON.stringify(actionConfig) : null

    try {
      await this.pool.execute(
        `INSERT INTO atc_item_definitions
           (id, label, description, category, stackable, max_stack, weight_grams, usable, tradable,
            metadata_schema_json, status, image_url, icon, tags_json, sort_order, action_config_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, label, description, category, stackable ? 1 : 0, maxStack, weightGrams,
         usable ? 1 : 0, tradable ? 1 : 0, metaJson, status, imageUrl, icon, tagsJson, sortOrder,
         actionConfigJson],
      )
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ItemDefinitionDuplicateError(id)
      }
      throw err
    }

    const row = await this.findById(id)
    if (!row) throw new Error(`ItemDefinition not found after create: ${id}`)
    return row
  }

  // ── Phase 7: update (PATCH mutable fields — increments version) ───────────

  async update(itemId: string, patch: UpdateItemDefinitionParams): Promise<AtcItemDefinition> {
    const setClauses: string[] = []
    const values: (string | number | null)[] = []

    if (patch.label !== undefined) { setClauses.push('label = ?'); values.push(patch.label) }
    if (patch.description !== undefined) { setClauses.push('description = ?'); values.push(patch.description) }
    if (patch.category !== undefined) { setClauses.push('category = ?'); values.push(patch.category) }
    if (patch.stackable !== undefined) { setClauses.push('stackable = ?'); values.push(patch.stackable ? 1 : 0) }
    if (patch.maxStack !== undefined) { setClauses.push('max_stack = ?'); values.push(patch.maxStack) }
    if (patch.weightGrams !== undefined) { setClauses.push('weight_grams = ?'); values.push(patch.weightGrams) }
    if (patch.usable !== undefined) { setClauses.push('usable = ?'); values.push(patch.usable ? 1 : 0) }
    if (patch.tradable !== undefined) { setClauses.push('tradable = ?'); values.push(patch.tradable ? 1 : 0) }
    if (patch.metadataSchema !== undefined) {
      setClauses.push('metadata_schema_json = ?')
      values.push(patch.metadataSchema !== null ? JSON.stringify(patch.metadataSchema) : null)
    }
    if (patch.imageUrl !== undefined) { setClauses.push('image_url = ?'); values.push(patch.imageUrl) }
    if (patch.icon !== undefined) { setClauses.push('icon = ?'); values.push(patch.icon) }
    if (patch.tags !== undefined) { setClauses.push('tags_json = ?'); values.push(JSON.stringify(patch.tags)) }
    if (patch.sortOrder !== undefined) { setClauses.push('sort_order = ?'); values.push(patch.sortOrder) }
    if (patch.actionConfig !== undefined) {
      setClauses.push('action_config_json = ?')
      values.push(patch.actionConfig !== null ? JSON.stringify(patch.actionConfig) : null)
    }

    if (setClauses.length === 0) throw new Error('No fields provided for update')

    setClauses.push('version = version + 1')
    values.push(itemId)

    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE atc_item_definitions SET ${setClauses.join(', ')} WHERE id = ?`,
      values,
    )

    if (result.affectedRows === 0) throw new ItemDefinitionNotFoundError(itemId)

    const row = await this.findById(itemId)
    if (!row) throw new Error(`ItemDefinition not found after update: ${itemId}`)
    return row
  }

  // ── Phase 7: bulkUpsert (transactional, increments version on UPDATE) ─────

  async bulkUpsert(items: UpsertItemDefinitionParams[]): Promise<{ upserted: number; items: AtcItemDefinition[] }> {
    if (items.length === 0) return { upserted: 0, items: [] }

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      for (const params of items) {
        const {
          id,
          label,
          description = null,
          category,
          stackable = true,
          maxStack = 100,
          weightGrams = 0,
          usable = false,
          tradable = true,
          metadataSchema,
          status = 'active',
          imageUrl = null,
          icon = null,
          tags = [],
          sortOrder = 0,
          actionConfig,
        } = params

        const metaJson = metadataSchema !== undefined ? JSON.stringify(metadataSchema) : null
        const tagsJson = JSON.stringify(tags)
        const actionConfigJson = actionConfig !== undefined ? JSON.stringify(actionConfig) : null

        await conn.execute(
          `INSERT INTO atc_item_definitions
             (id, label, description, category, stackable, max_stack, weight_grams, usable, tradable,
              metadata_schema_json, status, image_url, icon, tags_json, sort_order, action_config_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             label                = VALUES(label),
             description          = VALUES(description),
             category             = VALUES(category),
             stackable            = VALUES(stackable),
             max_stack            = VALUES(max_stack),
             weight_grams         = VALUES(weight_grams),
             usable               = VALUES(usable),
             tradable             = VALUES(tradable),
             metadata_schema_json = VALUES(metadata_schema_json),
             status               = VALUES(status),
             image_url            = VALUES(image_url),
             icon                 = VALUES(icon),
             tags_json            = VALUES(tags_json),
             sort_order           = VALUES(sort_order),
             action_config_json   = VALUES(action_config_json),
             version              = version + 1`,
          [id, label, description, category, stackable ? 1 : 0, maxStack, weightGrams,
           usable ? 1 : 0, tradable ? 1 : 0, metaJson, status, imageUrl, icon, tagsJson, sortOrder,
           actionConfigJson],
        )
      }

      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }

    const ids = items.map((i) => i.id)
    const placeholders = ids.map(() => '?').join(', ')
    const [rows] = await this.pool.execute<ItemDefinitionRow[]>(
      `SELECT * FROM atc_item_definitions WHERE id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
      ids,
    )
    const result = rows.map(rowToItemDefinition)
    return { upserted: result.length, items: result }
  }

  // ── Phase 7: listCatalog (admin filtered view — all statuses) ─────────────

  async listCatalog(query: AtcItemCatalogQuery): Promise<AtcItemDefinition[]> {
    const { category, status, tag, search, limit = 100, offset = 0 } = query
    const conditions: string[] = []
    const values: (string | number)[] = []

    if (category) { conditions.push('category = ?'); values.push(category) }
    if (status) { conditions.push('status = ?'); values.push(status) }
    if (tag) { conditions.push("JSON_CONTAINS(tags_json, JSON_QUOTE(?), '$') = 1"); values.push(tag) }
    if (search) {
      conditions.push('(id LIKE ? OR label LIKE ? OR category LIKE ?)')
      const pattern = `%${search}%`
      values.push(pattern, pattern, pattern)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const [rows] = await this.pool.execute<ItemDefinitionRow[]>(
      `SELECT * FROM atc_item_definitions ${where} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    )
    return rows.map(rowToItemDefinition)
  }

  // ── Phase 7: getUsageCount ────────────────────────────────────────────────

  async getUsageCount(itemId: string): Promise<number> {
    const [rows] = await this.pool.execute<UsageCountRow[]>(
      'SELECT COUNT(*) as usage_count FROM atc_character_inventory WHERE item_id = ?',
      [itemId],
    )
    return rows[0]?.usage_count ?? 0
  }

  // ── Phase 7: safeDisable / safeDeprecate ─────────────────────────────────

  async safeDisable(itemId: string): Promise<AtcItemDefinition> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      "UPDATE atc_item_definitions SET status = 'disabled', version = version + 1 WHERE id = ?",
      [itemId],
    )
    if (result.affectedRows === 0) throw new ItemDefinitionNotFoundError(itemId)
    const row = await this.findById(itemId)
    if (!row) throw new Error(`ItemDefinition not found after disable: ${itemId}`)
    return row
  }

  async safeDeprecate(itemId: string): Promise<AtcItemDefinition> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      "UPDATE atc_item_definitions SET status = 'deprecated', version = version + 1 WHERE id = ?",
      [itemId],
    )
    if (result.affectedRows === 0) throw new ItemDefinitionNotFoundError(itemId)
    const row = await this.findById(itemId)
    if (!row) throw new Error(`ItemDefinition not found after deprecate: ${itemId}`)
    return row
  }

  // ── Existing read methods ─────────────────────────────────────────────────

  async findById(id: string): Promise<AtcItemDefinition | null> {
    const [rows] = await this.pool.execute<ItemDefinitionRow[]>(
      'SELECT * FROM atc_item_definitions WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? rowToItemDefinition(rows[0]) : null
  }

  async listActive(): Promise<AtcItemDefinition[]> {
    const [rows] = await this.pool.execute<ItemDefinitionRow[]>(
      "SELECT * FROM atc_item_definitions WHERE status = 'active' ORDER BY sort_order ASC, category ASC, id ASC",
    )
    return rows.map(rowToItemDefinition)
  }

  async disable(id: string): Promise<void> {
    await this.pool.execute(
      "UPDATE atc_item_definitions SET status = 'disabled' WHERE id = ?",
      [id],
    )
  }
}
