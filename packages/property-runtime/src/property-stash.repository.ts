import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { AtcPropertyStash, AtcPropertyStashItem, AtcPropertyStashType } from '@atc/shared-types'
import type { PropertyPool } from './pool.js'
import { generateId } from './id.js'
import {
  StashNotFoundError,
  StashCapacityError,
  StashItemNotFoundError,
  StashInsufficientQuantityError,
} from './errors.js'

interface StashRow extends RowDataPacket {
  id: string
  property_id: string
  stash_id: string
  label: string
  stash_type: string
  owner_id: string | null
  organization_id: string | null
  capacity: number
  is_locked: number
  created_at: Date
  updated_at: Date
}

interface StashItemRow extends RowDataPacket {
  id: string
  stash_record_id: string
  item_name: string
  quantity: number
  metadata: unknown
  added_by_principal_id: string
  added_at: Date
}

function rowToStash(row: StashRow): AtcPropertyStash {
  return {
    id: row.id,
    propertyId: row.property_id,
    stashId: row.stash_id,
    label: row.label,
    stashType: row.stash_type as AtcPropertyStashType,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    capacity: row.capacity,
    isLocked: row.is_locked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToItem(row: StashItemRow): AtcPropertyStashItem {
  return {
    id: row.id,
    stashRecordId: row.stash_record_id,
    itemName: row.item_name,
    quantity: row.quantity,
    metadata: row.metadata,
    addedByPrincipalId: row.added_by_principal_id,
    addedAt: row.added_at,
  }
}

export interface CreateStashParams {
  propertyId: string
  stashId: string
  label: string
  stashType?: AtcPropertyStashType | undefined
  ownerId?: string | null | undefined
  organizationId?: string | null | undefined
  capacity?: number | undefined
}

export class PropertyStashRepository {
  constructor(private readonly pool: PropertyPool) {}

  async createStash(params: CreateStashParams): Promise<AtcPropertyStash> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_property_stashes
           (id, property_id, stash_id, label, stash_type, owner_id, organization_id,
            capacity, is_locked, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(3), NOW(3))`,
        [
          id,
          params.propertyId,
          params.stashId,
          params.label,
          params.stashType ?? 'personal',
          params.ownerId ?? null,
          params.organizationId ?? null,
          params.capacity ?? 50,
        ],
      )
      const stash = await this.findByStashId(params.propertyId, params.stashId)
      if (!stash) throw new StashNotFoundError(params.stashId)
      return stash
    } finally {
      conn.release()
    }
  }

  async deposit(
    stashRecordId: string,
    itemName: string,
    quantity: number,
    metadata: unknown,
    addedByPrincipalId: string,
  ): Promise<AtcPropertyStashItem> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        // Lock stash to prevent concurrent capacity races
        const [stashRows] = await conn.execute<StashRow[]>(
          `SELECT * FROM atc_property_stashes WHERE id = ? LIMIT 1 FOR UPDATE`,
          [stashRecordId],
        )
        if (!stashRows[0]) throw new StashNotFoundError(stashRecordId)
        const stash = rowToStash(stashRows[0])

        // Count current distinct item types
        const [countRows] = await conn.execute<(RowDataPacket & { cnt: number })[]>(
          `SELECT COUNT(*) AS cnt FROM atc_property_stash_items
           WHERE stash_record_id = ?`,
          [stashRecordId],
        )
        const currentCount = countRows[0]?.cnt ?? 0

        // Check if item already exists (will be an UPDATE, not INSERT — no capacity impact)
        const [existing] = await conn.execute<StashItemRow[]>(
          `SELECT id FROM atc_property_stash_items
           WHERE stash_record_id = ? AND item_name = ? LIMIT 1`,
          [stashRecordId, itemName],
        )

        if (existing.length === 0 && currentCount >= stash.capacity) {
          throw new StashCapacityError(stashRecordId, stash.capacity)
        }

        const itemId = generateId()
        await conn.execute(
          `INSERT INTO atc_property_stash_items
             (id, stash_record_id, item_name, quantity, metadata, added_by_principal_id, added_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3))
           ON DUPLICATE KEY UPDATE
             quantity = quantity + VALUES(quantity),
             metadata = VALUES(metadata),
             added_by_principal_id = VALUES(added_by_principal_id),
             added_at = NOW(3)`,
          [itemId, stashRecordId, itemName, quantity, JSON.stringify(metadata ?? null), addedByPrincipalId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const item = await this.findItem(stashRecordId, itemName)
      if (!item) throw new StashItemNotFoundError(stashRecordId, itemName)
      return item
    } finally {
      conn.release()
    }
  }

  async withdraw(
    stashRecordId: string,
    itemName: string,
    quantity: number,
    removedByPrincipalId: string,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        // Lock stash row
        const [stashRows] = await conn.execute<StashRow[]>(
          `SELECT id FROM atc_property_stashes WHERE id = ? LIMIT 1 FOR UPDATE`,
          [stashRecordId],
        )
        if (!stashRows[0]) throw new StashNotFoundError(stashRecordId)

        // Lock item row
        const [itemRows] = await conn.execute<StashItemRow[]>(
          `SELECT * FROM atc_property_stash_items
           WHERE stash_record_id = ? AND item_name = ? LIMIT 1 FOR UPDATE`,
          [stashRecordId, itemName],
        )
        if (!itemRows[0]) throw new StashItemNotFoundError(stashRecordId, itemName)
        if (itemRows[0].quantity < quantity) {
          throw new StashInsufficientQuantityError(itemName, quantity, itemRows[0].quantity)
        }

        if (itemRows[0].quantity === quantity) {
          // Remove the slot entirely
          await conn.execute(
            `DELETE FROM atc_property_stash_items
             WHERE stash_record_id = ? AND item_name = ?`,
            [stashRecordId, itemName],
          )
        } else {
          await conn.execute(
            `UPDATE atc_property_stash_items
             SET quantity = quantity - ?
             WHERE stash_record_id = ? AND item_name = ?`,
            [quantity, stashRecordId, itemName],
          )
        }
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async findByStashId(propertyId: string, stashId: string): Promise<AtcPropertyStash | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StashRow[]>(
        `SELECT * FROM atc_property_stashes
         WHERE property_id = ? AND stash_id = ? LIMIT 1`,
        [propertyId, stashId],
      )
      return rows[0] ? rowToStash(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByRecordId(recordId: string): Promise<AtcPropertyStash | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StashRow[]>(
        `SELECT * FROM atc_property_stashes WHERE id = ? LIMIT 1`,
        [recordId],
      )
      return rows[0] ? rowToStash(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByProperty(propertyId: string): Promise<AtcPropertyStash[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StashRow[]>(
        `SELECT * FROM atc_property_stashes WHERE property_id = ? ORDER BY created_at ASC`,
        [propertyId],
      )
      return rows.map(rowToStash)
    } finally {
      conn.release()
    }
  }

  async getContents(stashRecordId: string): Promise<AtcPropertyStashItem[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StashItemRow[]>(
        `SELECT * FROM atc_property_stash_items
         WHERE stash_record_id = ? ORDER BY item_name ASC`,
        [stashRecordId],
      )
      return rows.map(rowToItem)
    } finally {
      conn.release()
    }
  }

  async findItem(stashRecordId: string, itemName: string): Promise<AtcPropertyStashItem | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StashItemRow[]>(
        `SELECT * FROM atc_property_stash_items
         WHERE stash_record_id = ? AND item_name = ? LIMIT 1`,
        [stashRecordId, itemName],
      )
      return rows[0] ? rowToItem(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
