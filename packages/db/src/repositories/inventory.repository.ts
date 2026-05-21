import { createHash } from 'node:crypto'
import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import { generateId } from '../id.js'
import type {
  AtcInventorySlot,
  AtcInventoryTransaction,
  AtcInventoryTransactionType,
  AtcInventoryTransactionSource,
  AtcInventoryResponse,
  AtcInventoryWeightSummary,
  AtcInventoryMutationResponse,
  AtcInventorySettings,
  AtcInventoryCapacitySummary,
  AtcItemDefinition,
} from '@atc/shared-types'

// ── Constants ──────────────────────────────────────────────────────────────────

/** Absolute DB maximum — matches the CHECK constraint on atc_character_inventory.slot */
const MAX_SLOTS = 120

// ── Custom errors ─────────────────────────────────────────────────────────────

export class InventoryItemNotFoundError extends Error {
  constructor(message = 'Item definition not found or not active') {
    super(message)
    this.name = 'InventoryItemNotFoundError'
  }
}

export class InventorySlotOccupiedError extends Error {
  constructor(message = 'Inventory slot is already occupied') {
    super(message)
    this.name = 'InventorySlotOccupiedError'
  }
}

export class InventoryInsufficientQuantityError extends Error {
  constructor(message = 'Insufficient item quantity') {
    super(message)
    this.name = 'InventoryInsufficientQuantityError'
  }
}

export class InventoryFullError extends Error {
  constructor(message = 'Inventory is full — no free slots') {
    super(message)
    this.name = 'InventoryFullError'
  }
}

export class InventoryStackLimitError extends Error {
  constructor(message = 'Adding this quantity would exceed the item maxStack') {
    super(message)
    this.name = 'InventoryStackLimitError'
  }
}

export class InventoryIdempotencyPayloadMismatchError extends Error {
  constructor(message = 'Idempotency key reused with a different payload') {
    super(message)
    this.name = 'InventoryIdempotencyPayloadMismatchError'
  }
}

export class InventoryOverweightError extends Error {
  constructor(message = 'Adding this item would exceed the weight limit') {
    super(message)
    this.name = 'InventoryOverweightError'
  }
}

export class InventoryCapacityError extends Error {
  constructor(message = 'Target slot exceeds inventory capacity') {
    super(message)
    this.name = 'InventoryCapacityError'
  }
}

export class InventoryMetadataValidationError extends Error {
  constructor(message = 'Item metadata failed schema validation') {
    super(message)
    this.name = 'InventoryMetadataValidationError'
  }
}

export class InventorySettingsConflictError extends Error {
  constructor(message = 'Cannot update settings: conflict with existing inventory state') {
    super(message)
    this.name = 'InventorySettingsConflictError'
  }
}

export class InventoryItemBrokenError extends Error {
  constructor(message = 'Item has no remaining durability and cannot be used') {
    super(message)
    this.name = 'InventoryItemBrokenError'
  }
}

// ── Param interfaces ─────────────────────────────────────────────────────────

export interface AddItemParams {
  characterId: string
  itemId: string
  quantity: number
  slot?: number
  reason: string
  source: AtcInventoryTransactionSource
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface RemoveItemParams {
  characterId: string
  itemId: string
  quantity: number
  slot?: number
  reason: string
  source: AtcInventoryTransactionSource
  idempotencyKey: string
}

export interface MoveItemParams {
  characterId: string
  fromSlot: number
  toSlot: number
  quantity?: number
  idempotencyKey: string
}

export interface UpdateSettingsParams {
  maxSlots?: number
  maxWeightGrams?: number
}

export interface UseItemParams {
  characterId: string
  slot: number
  consumeQuantity: number
  durabilityCost: number
  destroyOnEmpty: boolean
  idempotencyKey: string
}

export interface UseItemResult {
  itemId: string
  consumed: number
  remainingQuantity: number
  durability: number | null
  destroyed: boolean
  idempotent: boolean
}

// ── DB row shapes ─────────────────────────────────────────────────────────────

interface InventorySlotRow extends RowDataPacket {
  id: string
  character_id: string
  item_id: string
  slot: number
  quantity: number
  metadata_json: string | null
  durability: number | null
  equipped: number
  last_used_at: Date | null
  created_at: Date
  updated_at: Date
}

interface InventoryTransactionRow extends RowDataPacket {
  id: string
  character_id: string
  type: string
  item_id: string | null
  slot_from: number | null
  slot_to: number | null
  quantity: number | null
  reason: string
  source: string
  idempotency_key: string
  payload_hash: string | null
  metadata_json: string | null
  created_at: Date
}

interface WeightRow extends RowDataPacket {
  total_weight_grams: string | null
}

interface ItemDefinitionRow extends RowDataPacket {
  stackable: number
  max_stack: number
  weight_grams: number
  status: string
  metadata_schema_json: string | null
}

interface InventorySettingsRow extends RowDataPacket {
  character_id: string
  max_slots: number
  max_weight_grams: number
  created_at: Date
  updated_at: Date
}

interface SlotCountRow extends RowDataPacket {
  used_count: number
}

interface MaxSlotRow extends RowDataPacket {
  max_slot: number | null
}

// ── Module-level helpers ───────────────────────────────────────────────────────

function computePayloadHash(canonical: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}

// Recursively sorts all object keys so that { b:1, a:2 } and { a:2, b:1 } compare equal.
// Empty objects {} are treated as null — no meaningful metadata.
function deepSortKeys(val: unknown): unknown {
  if (val === null || val === undefined) return val
  if (Array.isArray(val)) return val.map(deepSortKeys)
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))
    return Object.fromEntries(entries.map(([k, v]) => [k, deepSortKeys(v)]))
  }
  return val
}

function sortedStringify(obj: Record<string, unknown> | null | undefined): string {
  if (obj === null || obj === undefined) return 'null'
  if (Object.keys(obj).length === 0) return 'null' // treat {} same as no metadata
  return JSON.stringify(deepSortKeys(obj))
}

export function validateMetadataSchema(
  schema: Record<string, unknown> | null,
  metadata: Record<string, unknown> | undefined,
): string[] {
  if (!schema) return []
  const s = schema as {
    required?: string[]
    strict?: boolean
    properties?: Record<string, {
      type: 'string' | 'number' | 'boolean'
      maxLength?: number
      min?: number
      max?: number
    }>
  }
  const meta = metadata ?? {}
  const errors: string[] = []
  for (const key of (s.required ?? [])) {
    if (!(key in meta)) errors.push(`Required metadata key '${key}' is missing`)
  }
  if (s.strict) {
    const allowed = new Set(Object.keys(s.properties ?? {}))
    for (const key of Object.keys(meta)) {
      if (!allowed.has(key)) errors.push(`Unknown metadata key '${key}' not allowed (strict mode)`)
    }
  }
  for (const [key, def] of Object.entries(s.properties ?? {})) {
    if (!(key in meta)) continue
    const value = meta[key]
    if (def.type === 'string') {
      if (typeof value !== 'string') { errors.push(`'${key}' must be a string`); continue }
      if (def.maxLength !== undefined && value.length > def.maxLength) errors.push(`'${key}' exceeds maxLength of ${def.maxLength}`)
    } else if (def.type === 'number') {
      if (typeof value !== 'number') { errors.push(`'${key}' must be a number`); continue }
      if (def.min !== undefined && value < def.min) errors.push(`'${key}' must be >= ${def.min}`)
      if (def.max !== undefined && value > def.max) errors.push(`'${key}' must be <= ${def.max}`)
    } else if (def.type === 'boolean') {
      if (typeof value !== 'boolean') errors.push(`'${key}' must be a boolean`)
    }
  }
  return errors
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToSlot(row: InventorySlotRow): AtcInventorySlot {
  return {
    id: row.id,
    characterId: row.character_id,
    itemId: row.item_id,
    slot: row.slot,
    quantity: row.quantity,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    durability: row.durability ?? null,
    equipped: (row.equipped ?? 0) === 1,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToTransaction(row: InventoryTransactionRow): AtcInventoryTransaction {
  return {
    id: row.id,
    characterId: row.character_id,
    type: row.type as AtcInventoryTransactionType,
    itemId: row.item_id,
    slotFrom: row.slot_from,
    slotTo: row.slot_to,
    quantity: row.quantity,
    reason: row.reason,
    source: row.source as AtcInventoryTransactionSource,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: row.created_at,
  }
}

function buildMutationResponse(
  tx: InventoryTransactionRow,
  idempotent: boolean,
): AtcInventoryMutationResponse {
  return {
    transactionId: tx.id,
    characterId: tx.character_id,
    slot: tx.slot_to ?? tx.slot_from,
    itemId: tx.item_id,
    quantity: tx.quantity ?? 0,
    type: tx.type as AtcInventoryTransactionType,
    idempotent,
  }
}

function rowToSettings(row: InventorySettingsRow): AtcInventorySettings {
  return {
    characterId: row.character_id,
    maxSlots: row.max_slots,
    maxWeightGrams: row.max_weight_grams,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class InventoryRepository {
  constructor(private readonly pool: DbPool) {}

  // ── Settings ────────────────────────────────────────────────────────────────

  async getOrCreateSettings(characterId: string): Promise<AtcInventorySettings> {
    await this.pool.execute(
      'INSERT INTO atc_character_inventory_settings (character_id) VALUES (?) ON DUPLICATE KEY UPDATE character_id = character_id',
      [characterId],
    )
    const [rows] = await this.pool.execute<InventorySettingsRow[]>(
      'SELECT * FROM atc_character_inventory_settings WHERE character_id = ? LIMIT 1',
      [characterId],
    )
    const row = rows[0]
    if (!row) {
      throw new Error(`Failed to read inventory settings for character ${characterId} after upsert`)
    }
    return rowToSettings(row)
  }

  async updateSettings(characterId: string, input: UpdateSettingsParams): Promise<AtcInventorySettings> {
    // Ensure the row exists before any conflict checks
    await this.getOrCreateSettings(characterId)

    if (input.maxSlots !== undefined) {
      const [slotRows] = await this.pool.execute<MaxSlotRow[]>(
        'SELECT MAX(slot) as max_slot FROM atc_character_inventory WHERE character_id = ?',
        [characterId],
      )
      const highestSlot = slotRows[0]?.max_slot ?? null
      if (highestSlot !== null && highestSlot > input.maxSlots) {
        throw new InventorySettingsConflictError(
          `Cannot reduce maxSlots to ${input.maxSlots}: character has an item in slot ${highestSlot}`,
        )
      }
    }

    // BUG-6-2: maxWeightGrams === 0 means unlimited — no conflict to check
    if (input.maxWeightGrams !== undefined && input.maxWeightGrams > 0) {
      const currentWeightGrams = await this._totalWeightGrams(characterId)
      if (currentWeightGrams > input.maxWeightGrams) {
        throw new InventorySettingsConflictError(
          `Cannot reduce maxWeightGrams to ${input.maxWeightGrams}: current inventory weight is ${currentWeightGrams}g`,
        )
      }
    }

    // Build dynamic UPDATE — only touch provided fields
    const setClauses: string[] = []
    const values: (string | number)[] = []
    if (input.maxSlots !== undefined) {
      setClauses.push('max_slots = ?')
      values.push(input.maxSlots)
    }
    if (input.maxWeightGrams !== undefined) {
      setClauses.push('max_weight_grams = ?')
      values.push(input.maxWeightGrams)
    }
    if (setClauses.length > 0) {
      values.push(characterId)
      await this.pool.execute(
        `UPDATE atc_character_inventory_settings SET ${setClauses.join(', ')} WHERE character_id = ?`,
        values,
      )
    }

    return this.getOrCreateSettings(characterId)
  }

  // ── Read operations ─────────────────────────────────────────────────────────

  async getByCharacter(characterId: string): Promise<AtcInventoryResponse> {
    const [[slotRows], settings] = await Promise.all([
      this.pool.execute<InventorySlotRow[]>(
        'SELECT * FROM atc_character_inventory WHERE character_id = ? ORDER BY slot',
        [characterId],
      ),
      this.getOrCreateSettings(characterId),
    ])
    const slots = slotRows.map(rowToSlot)
    const totalWeightGrams = await this._totalWeightGrams(characterId)
    // BUG-6-2: maxWeightGrams === 0 means unlimited
    const unlimited = settings.maxWeightGrams === 0
    const weightSummary: AtcInventoryWeightSummary = {
      totalWeightGrams,
      maxWeightGrams: settings.maxWeightGrams,
      isOverweight: unlimited ? false : totalWeightGrams > settings.maxWeightGrams,
      remainingWeightGrams: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, settings.maxWeightGrams - totalWeightGrams),
    }
    const usedSlots = slots.length
    const capacitySummary: AtcInventoryCapacitySummary = {
      usedSlots,
      maxSlots: settings.maxSlots,
      freeSlots: Math.max(0, settings.maxSlots - usedSlots),
      isFull: usedSlots >= settings.maxSlots,
    }
    return { characterId, slots, settings, weightSummary, capacitySummary }
  }

  async getSlot(characterId: string, slot: number): Promise<AtcInventorySlot | null> {
    const [rows] = await this.pool.execute<InventorySlotRow[]>(
      'SELECT * FROM atc_character_inventory WHERE character_id = ? AND slot = ? LIMIT 1',
      [characterId, slot],
    )
    return rows[0] ? rowToSlot(rows[0]) : null
  }

  /** Private: returns the raw total weight in grams for a character. */
  private async _totalWeightGrams(characterId: string): Promise<number> {
    const [rows] = await this.pool.execute<WeightRow[]>(
      `SELECT SUM(inv.quantity * item.weight_grams) AS total_weight_grams
       FROM atc_character_inventory inv
       JOIN atc_item_definitions item ON item.id = inv.item_id
       WHERE inv.character_id = ?`,
      [characterId],
    )
    const raw = rows[0]?.total_weight_grams
    const totalWeightGrams = raw !== null && raw !== undefined ? Number(raw) : 0
    // BUG-9 fix: guard against safe-integer overflow from extreme weight values
    if (!Number.isSafeInteger(totalWeightGrams)) {
      throw new Error(
        `Weight integrity: total_weight_grams "${raw}" exceeds Number.MAX_SAFE_INTEGER — precision loss risk`,
      )
    }
    return totalWeightGrams
  }

  async calculateWeight(characterId: string): Promise<AtcInventoryWeightSummary> {
    const [settings, totalWeightGrams] = await Promise.all([
      this.getOrCreateSettings(characterId),
      this._totalWeightGrams(characterId),
    ])
    // BUG-6-2: maxWeightGrams === 0 means unlimited
    const unlimited = settings.maxWeightGrams === 0
    return {
      totalWeightGrams,
      maxWeightGrams: settings.maxWeightGrams,
      isOverweight: unlimited ? false : totalWeightGrams > settings.maxWeightGrams,
      remainingWeightGrams: unlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, settings.maxWeightGrams - totalWeightGrams),
    }
  }

  async getCapacitySummary(characterId: string): Promise<AtcInventoryCapacitySummary> {
    const settings = await this.getOrCreateSettings(characterId)
    const [countRows] = await this.pool.execute<SlotCountRow[]>(
      'SELECT COUNT(*) as used_count FROM atc_character_inventory WHERE character_id = ?',
      [characterId],
    )
    const usedSlots = countRows[0]?.used_count ?? 0
    return {
      usedSlots,
      maxSlots: settings.maxSlots,
      freeSlots: Math.max(0, settings.maxSlots - usedSlots),
      isFull: usedSlots >= settings.maxSlots,
    }
  }

  async listTransactions(
    characterId: string,
    limit: number,
    offset: number,
  ): Promise<AtcInventoryTransaction[]> {
    const [rows] = await this.pool.execute<InventoryTransactionRow[]>(
      'SELECT * FROM atc_inventory_transactions WHERE character_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [characterId, limit, offset],
    )
    return rows.map(rowToTransaction)
  }

  // ── Validation helpers ──────────────────────────────────────────────────────

  validateMetadata(
    itemDef: AtcItemDefinition,
    metadata: Record<string, unknown> | undefined,
  ): { valid: boolean; errors: string[] } {
    const errors = validateMetadataSchema(
      itemDef.metadataSchema as Record<string, unknown> | null,
      metadata,
    )
    return { valid: errors.length === 0, errors }
  }

  async validateCanAdd(
    characterId: string,
    itemDef: AtcItemDefinition,
    quantity: number,
    metadata?: Record<string, unknown>,
  ): Promise<Array<{ code: string; message: string }>> {
    const violations: Array<{ code: string; message: string }> = []

    // Metadata schema validation
    const metaErrors = validateMetadataSchema(
      itemDef.metadataSchema as Record<string, unknown> | null,
      metadata,
    )
    for (const msg of metaErrors) {
      violations.push({ code: 'METADATA_INVALID', message: msg })
    }

    const [settings, totalWeightGrams] = await Promise.all([
      this.getOrCreateSettings(characterId),
      this._totalWeightGrams(characterId),
    ])

    // Weight check — BUG-6-2: maxWeightGrams === 0 means unlimited
    const addedWeightGrams = quantity * itemDef.weightGrams
    if (settings.maxWeightGrams > 0 && totalWeightGrams + addedWeightGrams > settings.maxWeightGrams) {
      violations.push({
        code: 'OVERWEIGHT',
        message: `Adding ${addedWeightGrams}g would exceed weight limit (current: ${totalWeightGrams}g, limit: ${settings.maxWeightGrams}g)`,
      })
    }

    // Capacity check
    const [countRows] = await this.pool.execute<SlotCountRow[]>(
      'SELECT COUNT(*) as used_count FROM atc_character_inventory WHERE character_id = ?',
      [characterId],
    )
    const usedSlots = countRows[0]?.used_count ?? 0
    if (usedSlots >= settings.maxSlots) {
      violations.push({
        code: 'INVENTORY_FULL',
        message: `Inventory is full (${usedSlots}/${settings.maxSlots} slots used)`,
      })
    }

    return violations
  }

  // ── Add item ────────────────────────────────────────────────────────────────

  async addItem(params: AddItemParams): Promise<AtcInventoryMutationResponse> {
    const { characterId, itemId, quantity, slot: requestedSlot, reason, source, idempotencyKey, metadata } = params
    const payloadHash = computePayloadHash({ characterId, itemId, quantity, slot: requestedSlot ?? null })

    // Non-transactional: get/create per-character settings before acquiring a connection
    const settings = await this.getOrCreateSettings(characterId)

    // Slot range check before we even open a transaction
    if (requestedSlot !== undefined && requestedSlot > settings.maxSlots) {
      throw new InventoryCapacityError(
        `Slot ${requestedSlot} exceeds character inventory capacity of ${settings.maxSlots}`,
      )
    }

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Idempotency check — BUG-4 fix: no manual rollback before throw; catch handles it
      const [existingTx] = await conn.execute<InventoryTransactionRow[]>(
        'SELECT * FROM atc_inventory_transactions WHERE idempotency_key = ? LIMIT 1 FOR UPDATE',
        [idempotencyKey],
      )
      if (existingTx[0]) {
        if (existingTx[0].payload_hash !== null && existingTx[0].payload_hash !== payloadHash) {
          throw new InventoryIdempotencyPayloadMismatchError()
        }
        await conn.rollback()
        return buildMutationResponse(existingTx[0], true)
      }

      // Validate item definition — Phase 6: also fetch metadata_schema_json
      const [itemRows] = await conn.execute<ItemDefinitionRow[]>(
        'SELECT stackable, max_stack, weight_grams, status, metadata_schema_json FROM atc_item_definitions WHERE id = ? LIMIT 1',
        [itemId],
      )
      const itemDef = itemRows[0]
      if (!itemDef || itemDef.status !== 'active') {
        throw new InventoryItemNotFoundError()
      }

      // BUG-1 fix: enforce stack limits before any slot work
      if (quantity > itemDef.max_stack) {
        throw new InventoryStackLimitError(
          `Quantity ${quantity} exceeds item maxStack of ${itemDef.max_stack}`,
        )
      }

      // Phase 6: metadata schema validation (BUG-6-1: guard malformed JSON in DB)
      let metaSchemaRaw: Record<string, unknown> | null = null
      if (itemDef.metadata_schema_json) {
        try {
          metaSchemaRaw = JSON.parse(itemDef.metadata_schema_json) as Record<string, unknown>
        } catch {
          // Malformed schema stored in DB — treat as no constraint
        }
      }
      const metaErrors = validateMetadataSchema(metaSchemaRaw, metadata)
      if (metaErrors.length > 0) {
        throw new InventoryMetadataValidationError(metaErrors.join('; '))
      }

      // Phase 6: weight check inside the transaction
      const [weightRows] = await conn.execute<WeightRow[]>(
        `SELECT SUM(inv.quantity * item.weight_grams) AS total_weight_grams
         FROM atc_character_inventory inv
         JOIN atc_item_definitions item ON item.id = inv.item_id
         WHERE inv.character_id = ?`,
        [characterId],
      )
      const rawWeight = weightRows[0]?.total_weight_grams
      const currentWeightGrams = rawWeight !== null && rawWeight !== undefined ? Number(rawWeight) : 0
      const addedWeightGrams = quantity * itemDef.weight_grams
      // BUG-6-3: guard safe-integer overflow before arithmetic
      if (!Number.isSafeInteger(addedWeightGrams)) {
        throw new Error(`Weight integrity: addedWeightGrams ${addedWeightGrams} exceeds Number.MAX_SAFE_INTEGER`)
      }
      if (!Number.isSafeInteger(currentWeightGrams + addedWeightGrams)) {
        throw new Error(`Weight integrity: total weight sum exceeds Number.MAX_SAFE_INTEGER`)
      }
      // BUG-6-2: maxWeightGrams === 0 means unlimited — skip weight enforcement
      if (settings.maxWeightGrams > 0 && currentWeightGrams + addedWeightGrams > settings.maxWeightGrams) {
        throw new InventoryOverweightError(
          `Adding ${addedWeightGrams}g would exceed weight limit (current: ${currentWeightGrams}g, limit: ${settings.maxWeightGrams}g)`,
        )
      }

      const metaJson = metadata !== undefined ? JSON.stringify(metadata) : null
      const metaCanonical = sortedStringify(metadata)

      let targetSlot: number
      let mergedIntoExisting = false

      if (itemDef.stackable === 1) {
        // Attempt stack merge: find a slot with same item + matching metadata + room
        const [candidateRows] = await conn.execute<InventorySlotRow[]>(
          'SELECT * FROM atc_character_inventory WHERE character_id = ? AND item_id = ? FOR UPDATE',
          [characterId, itemId],
        )
        const mergeTarget = candidateRows.find((r) => {
          // BUG-3 fix: deep-sorted canonical comparison handles nested objects
          const existingMeta = sortedStringify(r.metadata_json ? JSON.parse(r.metadata_json) : null)
          return existingMeta === metaCanonical && r.quantity + quantity <= itemDef.max_stack
        })

        if (mergeTarget) {
          await conn.execute(
            'UPDATE atc_character_inventory SET quantity = quantity + ? WHERE id = ?',
            [quantity, mergeTarget.id],
          )
          targetSlot = mergeTarget.slot
          mergedIntoExisting = true
        }
      }

      if (!mergedIntoExisting) {
        if (requestedSlot !== undefined) {
          // BUG-2 fix: use FOR UPDATE to lock the specific slot row during check
          const [occupiedRows] = await conn.execute<InventorySlotRow[]>(
            'SELECT id FROM atc_character_inventory WHERE character_id = ? AND slot = ? LIMIT 1 FOR UPDATE',
            [characterId, requestedSlot],
          )
          if (occupiedRows[0]) {
            throw new InventorySlotOccupiedError()
          }
          targetSlot = requestedSlot
        } else {
          // BUG-2 fix: FOR UPDATE on the scan prevents concurrent transactions from
          // reading the same free-slot list and racing to INSERT into the same slot.
          const [occupiedRows] = await conn.execute<InventorySlotRow[]>(
            'SELECT slot FROM atc_character_inventory WHERE character_id = ? ORDER BY slot FOR UPDATE',
            [characterId],
          )
          const occupied = new Set(occupiedRows.map((r) => r.slot))
          let free: number | null = null
          // Phase 6: use per-character maxSlots instead of global MAX_SLOTS constant
          for (let s = 1; s <= settings.maxSlots; s++) {
            if (!occupied.has(s)) { free = s; break }
          }
          if (free === null) {
            throw new InventoryFullError()
          }
          targetSlot = free
        }

        // BUG-2 fix: catch ER_DUP_ENTRY as a final safety net for any residual race
        try {
          await conn.execute(
            'INSERT INTO atc_character_inventory (id, character_id, item_id, slot, quantity, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), characterId, itemId, targetSlot, quantity, metaJson],
          )
        } catch (insertErr: unknown) {
          if ((insertErr as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new InventorySlotOccupiedError('Concurrent write conflict — slot was taken')
          }
          throw insertErr
        }
      }

      const txId = generateId()
      await conn.execute(
        `INSERT INTO atc_inventory_transactions
           (id, character_id, type, item_id, slot_from, slot_to, quantity, reason, source, idempotency_key, payload_hash, metadata_json)
         VALUES (?, ?, 'add', ?, NULL, ?, ?, ?, ?, ?, ?, NULL)`,
        [txId, characterId, itemId, targetSlot!, quantity, reason, source, idempotencyKey, payloadHash],
      )

      await conn.commit()

      // BUG-5 fix: build response from known data — no extra round-trip after commit
      return {
        transactionId: txId,
        characterId,
        slot: targetSlot!,
        itemId,
        quantity,
        type: 'add',
        idempotent: false,
      }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  // ── Remove item ─────────────────────────────────────────────────────────────

  async removeItem(params: RemoveItemParams): Promise<AtcInventoryMutationResponse> {
    const { characterId, itemId, quantity, slot: requestedSlot, reason, source, idempotencyKey } = params
    const payloadHash = computePayloadHash({ characterId, itemId, quantity, slot: requestedSlot ?? null })

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // BUG-4 fix: no manual rollback before throw
      const [existingTx] = await conn.execute<InventoryTransactionRow[]>(
        'SELECT * FROM atc_inventory_transactions WHERE idempotency_key = ? LIMIT 1 FOR UPDATE',
        [idempotencyKey],
      )
      if (existingTx[0]) {
        if (existingTx[0].payload_hash !== null && existingTx[0].payload_hash !== payloadHash) {
          throw new InventoryIdempotencyPayloadMismatchError()
        }
        await conn.rollback()
        return buildMutationResponse(existingTx[0], true)
      }

      // Find and lock target slot
      let slotRow: InventorySlotRow | undefined
      if (requestedSlot !== undefined) {
        const [rows] = await conn.execute<InventorySlotRow[]>(
          'SELECT * FROM atc_character_inventory WHERE character_id = ? AND slot = ? AND item_id = ? LIMIT 1 FOR UPDATE',
          [characterId, requestedSlot, itemId],
        )
        slotRow = rows[0]
      } else {
        const [rows] = await conn.execute<InventorySlotRow[]>(
          'SELECT * FROM atc_character_inventory WHERE character_id = ? AND item_id = ? ORDER BY slot LIMIT 1 FOR UPDATE',
          [characterId, itemId],
        )
        slotRow = rows[0]
      }

      if (!slotRow) {
        throw new InventoryInsufficientQuantityError()
      }
      if (slotRow.quantity < quantity) {
        throw new InventoryInsufficientQuantityError()
      }

      const targetSlot = slotRow.slot
      if (slotRow.quantity === quantity) {
        await conn.execute('DELETE FROM atc_character_inventory WHERE id = ?', [slotRow.id])
      } else {
        await conn.execute(
          'UPDATE atc_character_inventory SET quantity = quantity - ? WHERE id = ?',
          [quantity, slotRow.id],
        )
      }

      const txId = generateId()
      await conn.execute(
        `INSERT INTO atc_inventory_transactions
           (id, character_id, type, item_id, slot_from, slot_to, quantity, reason, source, idempotency_key, payload_hash, metadata_json)
         VALUES (?, ?, 'remove', ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
        [txId, characterId, itemId, targetSlot, quantity, reason, source, idempotencyKey, payloadHash],
      )

      await conn.commit()

      // BUG-5 fix: build response from known data
      return {
        transactionId: txId,
        characterId,
        slot: targetSlot,
        itemId,
        quantity,
        type: 'remove',
        idempotent: false,
      }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  // ── Move item ───────────────────────────────────────────────────────────────

  async moveItem(params: MoveItemParams): Promise<AtcInventoryMutationResponse> {
    const { characterId, fromSlot, toSlot, quantity: requestedQty, idempotencyKey } = params
    const payloadHash = computePayloadHash({ characterId, fromSlot, toSlot, quantity: requestedQty ?? null })

    // Non-transactional: get/create per-character settings before acquiring a connection
    const settings = await this.getOrCreateSettings(characterId)

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // BUG-4 fix: no manual rollback before throw
      const [existingTx] = await conn.execute<InventoryTransactionRow[]>(
        'SELECT * FROM atc_inventory_transactions WHERE idempotency_key = ? LIMIT 1 FOR UPDATE',
        [idempotencyKey],
      )
      if (existingTx[0]) {
        if (existingTx[0].payload_hash !== null && existingTx[0].payload_hash !== payloadHash) {
          throw new InventoryIdempotencyPayloadMismatchError()
        }
        await conn.rollback()
        return buildMutationResponse(existingTx[0], true)
      }

      // Phase 6: validate toSlot against per-character capacity
      if (toSlot > settings.maxSlots) {
        throw new InventoryCapacityError(
          `Target slot ${toSlot} exceeds character inventory capacity of ${settings.maxSlots}`,
        )
      }

      // Lock both slots — order by slot number to prevent deadlock
      const [lowSlot, highSlot] = fromSlot < toSlot ? [fromSlot, toSlot] : [toSlot, fromSlot]
      const [lowRows] = await conn.execute<InventorySlotRow[]>(
        'SELECT * FROM atc_character_inventory WHERE character_id = ? AND slot = ? LIMIT 1 FOR UPDATE',
        [characterId, lowSlot],
      )
      const [highRows] = await conn.execute<InventorySlotRow[]>(
        'SELECT * FROM atc_character_inventory WHERE character_id = ? AND slot = ? LIMIT 1 FOR UPDATE',
        [characterId, highSlot],
      )
      const fromRow = fromSlot === lowSlot ? lowRows[0] : highRows[0]
      const toRow = toSlot === lowSlot ? lowRows[0] : highRows[0]

      if (!fromRow) {
        throw new InventoryInsufficientQuantityError('Source slot is empty')
      }

      const moveQty = requestedQty ?? fromRow.quantity
      if (moveQty > fromRow.quantity) {
        throw new InventoryInsufficientQuantityError('Move quantity exceeds slot quantity')
      }
      const isPartial = moveQty < fromRow.quantity

      const fromMetaCanonical = sortedStringify(fromRow.metadata_json ? JSON.parse(fromRow.metadata_json) : null)
      const toMetaCanonical = toRow ? sortedStringify(toRow.metadata_json ? JSON.parse(toRow.metadata_json) : null) : null
      const isSameItemCompatible =
        toRow !== undefined &&
        toRow.item_id === fromRow.item_id &&
        toMetaCanonical === fromMetaCanonical

      let resultSlot: number

      if (!toRow) {
        // toSlot is empty
        if (isPartial) {
          // SPLIT: decrease fromRow, insert at toSlot
          await conn.execute(
            'UPDATE atc_character_inventory SET quantity = quantity - ? WHERE id = ?',
            [moveQty, fromRow.id],
          )
          await conn.execute(
            'INSERT INTO atc_character_inventory (id, character_id, item_id, slot, quantity, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), characterId, fromRow.item_id, toSlot, moveQty, fromRow.metadata_json],
          )
        } else {
          // FULL: update slot
          await conn.execute(
            'UPDATE atc_character_inventory SET slot = ? WHERE id = ?',
            [toSlot, fromRow.id],
          )
        }
        resultSlot = toSlot
      } else if (isSameItemCompatible) {
        // Same item + same metadata: try merge
        const [itemDefRows] = await conn.execute<ItemDefinitionRow[]>(
          'SELECT max_stack, stackable FROM atc_item_definitions WHERE id = ? LIMIT 1',
          [fromRow.item_id],
        )
        const maxStack = itemDefRows[0]?.max_stack ?? 1
        const stackable = itemDefRows[0]?.stackable === 1

        if (!stackable || toRow.quantity + moveQty > maxStack) {
          // Can't merge (too full or non-stackable)
          throw new InventoryStackLimitError('Cannot merge: quantity would exceed maxStack')
        }
        // Merge
        await conn.execute(
          'UPDATE atc_character_inventory SET quantity = quantity + ? WHERE id = ?',
          [moveQty, toRow.id],
        )
        if (isPartial) {
          await conn.execute(
            'UPDATE atc_character_inventory SET quantity = quantity - ? WHERE id = ?',
            [moveQty, fromRow.id],
          )
        } else {
          await conn.execute('DELETE FROM atc_character_inventory WHERE id = ?', [fromRow.id])
        }
        resultSlot = toSlot
      } else {
        // Different item in toSlot
        if (isPartial) {
          throw new InventoryInsufficientQuantityError(
            'Cannot do partial move to slot occupied by a different item',
          )
        }
        // Full SWAP: DELETE target, UPDATE source slot, INSERT old target at source slot
        await conn.execute('DELETE FROM atc_character_inventory WHERE id = ?', [toRow.id])
        await conn.execute(
          'UPDATE atc_character_inventory SET slot = ? WHERE id = ?',
          [toSlot, fromRow.id],
        )
        await conn.execute(
          'INSERT INTO atc_character_inventory (id, character_id, item_id, slot, quantity, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
          [generateId(), characterId, toRow.item_id, fromSlot, toRow.quantity, toRow.metadata_json],
        )
        resultSlot = toSlot
      }

      const txId = generateId()
      await conn.execute(
        `INSERT INTO atc_inventory_transactions
           (id, character_id, type, item_id, slot_from, slot_to, quantity, reason, source, idempotency_key, payload_hash, metadata_json)
         VALUES (?, ?, 'move', ?, ?, ?, ?, 'slot move', 'api', ?, ?, NULL)`,
        [txId, characterId, fromRow.item_id, fromSlot, toSlot, moveQty, idempotencyKey, payloadHash],
      )

      await conn.commit()

      // BUG-5 fix: build response from known data
      return {
        transactionId: txId,
        characterId,
        slot: resultSlot,
        itemId: fromRow.item_id,
        quantity: moveQty,
        type: 'move',
        idempotent: false,
      }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  // ── Phase 8: executeUse — atomic item use (slot lock + quantity + durability) ─

  async executeUse(params: UseItemParams): Promise<UseItemResult> {
    const { characterId, slot, consumeQuantity, durabilityCost, destroyOnEmpty, idempotencyKey } = params

    // Idempotency check before opening a transaction
    const [existingTxRows] = await this.pool.execute<InventoryTransactionRow[]>(
      "SELECT * FROM atc_inventory_transactions WHERE idempotency_key = ? AND type = 'use' LIMIT 1",
      [idempotencyKey],
    )
    if (existingTxRows[0]) {
      const stored = existingTxRows[0].metadata_json
        ? (JSON.parse(existingTxRows[0].metadata_json) as {
            consumed: number
            remainingQuantity: number
            durability: number | null
            destroyed: boolean
          })
        : null
      return {
        itemId: existingTxRows[0].item_id ?? '',
        consumed: stored?.consumed ?? consumeQuantity,
        remainingQuantity: stored?.remainingQuantity ?? 0,
        durability: stored?.durability ?? null,
        destroyed: stored?.destroyed ?? false,
        idempotent: true,
      }
    }

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Lock the slot row for the duration of this transaction
      const [slotRows] = await conn.execute<InventorySlotRow[]>(
        'SELECT * FROM atc_character_inventory WHERE character_id = ? AND slot = ? LIMIT 1 FOR UPDATE',
        [characterId, slot],
      )
      const slotRow = slotRows[0]
      if (!slotRow) {
        throw new InventoryItemNotFoundError(`No item in slot ${slot}`)
      }

      // In-transaction idempotency guard — protects against concurrent requests that both
      // passed the pre-check before either committed (race condition safety net).
      const [innerTxRows] = await conn.execute<InventoryTransactionRow[]>(
        "SELECT * FROM atc_inventory_transactions WHERE idempotency_key = ? AND type = 'use' LIMIT 1",
        [idempotencyKey],
      )
      if (innerTxRows[0]) {
        const stored = innerTxRows[0].metadata_json
          ? (JSON.parse(innerTxRows[0].metadata_json) as {
              consumed: number
              remainingQuantity: number
              durability: number | null
              destroyed: boolean
            })
          : null
        await conn.rollback()
        return {
          itemId: innerTxRows[0].item_id ?? slotRow.item_id,
          consumed: stored?.consumed ?? consumeQuantity,
          remainingQuantity: stored?.remainingQuantity ?? 0,
          durability: stored?.durability ?? null,
          destroyed: stored?.destroyed ?? false,
          idempotent: true,
        }
      }

      // Quantity check
      if (slotRow.quantity < consumeQuantity) {
        throw new InventoryInsufficientQuantityError(
          `Slot ${slot} has ${slotRow.quantity} items but ${consumeQuantity} required`,
        )
      }

      // Durability check (only if slot tracks durability and cost > 0)
      if (durabilityCost > 0 && slotRow.durability !== null && slotRow.durability < durabilityCost) {
        throw new InventoryItemBrokenError(
          `Item durability (${slotRow.durability}) is insufficient for cost ${durabilityCost}`,
        )
      }

      const newQuantity = slotRow.quantity - consumeQuantity
      const newDurability =
        durabilityCost > 0 && slotRow.durability !== null
          ? Math.max(0, slotRow.durability - durabilityCost)
          : slotRow.durability
      const destroyed = newQuantity === 0 && destroyOnEmpty

      if (destroyed) {
        await conn.execute(
          'DELETE FROM atc_character_inventory WHERE id = ?',
          [slotRow.id],
        )
      } else {
        const setClauses: string[] = ['quantity = ?', 'last_used_at = NOW()']
        const values: (number | null | string)[] = [newQuantity]
        if (newDurability !== slotRow.durability) {
          setClauses.push('durability = ?')
          values.push(newDurability)
        }
        values.push(slotRow.id)
        await conn.execute(
          `UPDATE atc_character_inventory SET ${setClauses.join(', ')} WHERE id = ?`,
          values,
        )
      }

      const storedMeta = JSON.stringify({
        consumed: consumeQuantity,
        remainingQuantity: destroyed ? 0 : newQuantity,
        durability: newDurability,
        destroyed,
      })

      const txId = generateId()
      await conn.execute(
        `INSERT INTO atc_inventory_transactions
           (id, character_id, type, item_id, slot_from, slot_to, quantity, reason, source, idempotency_key, payload_hash, metadata_json)
         VALUES (?, ?, 'use', ?, ?, NULL, ?, 'item use', 'gameplay', ?, NULL, ?)`,
        [txId, characterId, slotRow.item_id, slot, consumeQuantity, idempotencyKey, storedMeta],
      )

      await conn.commit()

      return {
        itemId: slotRow.item_id,
        consumed: consumeQuantity,
        remainingQuantity: destroyed ? 0 : newQuantity,
        durability: newDurability,
        destroyed,
        idempotent: false,
      }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
}
