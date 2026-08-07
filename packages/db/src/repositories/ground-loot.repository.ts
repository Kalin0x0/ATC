import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import { generateId } from '../id.js'

export type GroundLootStatus = 'active' | 'picked_up' | 'expired'

export interface GroundLootItem {
  itemId: string
  quantity: number
}

export interface GroundLootRecord {
  id: string
  x: number
  y: number
  z: number
  droppedByCharacterId: string | null
  reason: string | null
  status: GroundLootStatus
  pickedUpByCharacterId: string | null
  pickedUpAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  items: GroundLootItem[]
}

interface LootRow extends RowDataPacket {
  id: string
  world_x: number
  world_y: number
  world_z: number
  dropped_by_character_id: string | null
  reason: string | null
  status: GroundLootStatus
  picked_up_by_character_id: string | null
  picked_up_at: Date | null
  expires_at: Date | null
  created_at: Date
}

interface LootItemRow extends RowDataPacket {
  loot_id: string
  item_id: string
  quantity: number
}

function rowToLoot(row: LootRow, items: GroundLootItem[]): GroundLootRecord {
  return {
    id: row.id,
    x: Number(row.world_x),
    y: Number(row.world_y),
    z: Number(row.world_z),
    droppedByCharacterId: row.dropped_by_character_id,
    reason: row.reason,
    status: row.status,
    pickedUpByCharacterId: row.picked_up_by_character_id,
    pickedUpAt: row.picked_up_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    items,
  }
}

export interface CreateGroundLootParams {
  x: number
  y: number
  z: number
  items: ReadonlyArray<GroundLootItem>
  droppedByCharacterId?: string | null
  reason?: string | null
  expiresAt?: Date | null
}

/**
 * Ground loot piles: what is lying on the floor and who may still take it.
 *
 * The pile's contents live here rather than on the clients that draw it, which
 * is what lets a pickup be granted at all — the server would otherwise have to
 * take the item list from the player picking it up.
 */
export class GroundLootRepository {
  constructor(private readonly pool: DbPool) {}

  /** Drop a pile. Items are written with it, so a pile is never briefly empty. */
  async create(params: CreateGroundLootParams): Promise<GroundLootRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_ground_loot
           (id, world_x, world_y, world_z, dropped_by_character_id, reason, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          id, params.x, params.y, params.z,
          params.droppedByCharacterId ?? null,
          params.reason ?? null,
          params.expiresAt ?? null,
        ],
      )
      for (const item of params.items) {
        await conn.execute(
          `INSERT INTO atc_ground_loot_items (id, loot_id, item_id, quantity)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
          [generateId(), id, item.itemId, item.quantity],
        )
      }
      await conn.commit()

      const created = await this.findById(id)
      if (!created) throw new Error(`Ground loot could not be stored: ${id}`)
      return created
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async findById(lootId: string): Promise<GroundLootRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<LootRow[]>(
        'SELECT * FROM atc_ground_loot WHERE id = ? LIMIT 1',
        [lootId],
      )
      const row = rows[0]
      if (!row) return null
      const [itemRows] = await conn.execute<LootItemRow[]>(
        'SELECT loot_id, item_id, quantity FROM atc_ground_loot_items WHERE loot_id = ? ORDER BY item_id',
        [lootId],
      )
      return rowToLoot(row, itemRows.map((r) => ({ itemId: r.item_id, quantity: Number(r.quantity) })))
    } finally {
      conn.release()
    }
  }

  /**
   * Piles still on the ground. Expired ones are excluded by time rather than by
   * status, so a pile whose expiry has passed stops being offered even if
   * nothing has swept it yet.
   */
  async listActive(limit = 500): Promise<GroundLootRecord[]> {
    // Inlined rather than bound: MySQL 8 rejects a placeholder in LIMIT over the
    // prepared-statement protocol ("Incorrect arguments to mysqld_stmt_execute")
    // where MariaDB accepts it. Clamped to an integer here, so nothing but a
    // number ever reaches the statement.
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 0, 1), 5000)
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<LootRow[]>(
        `SELECT * FROM atc_ground_loot
          WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW(3))
          ORDER BY created_at ASC
          LIMIT ${safeLimit}`,
      )
      if (rows.length === 0) return []

      const ids = rows.map((r) => r.id)
      const [itemRows] = await conn.query<LootItemRow[]>(
        'SELECT loot_id, item_id, quantity FROM atc_ground_loot_items WHERE loot_id IN (?) ORDER BY item_id',
        [ids],
      )
      const byLoot = new Map<string, GroundLootItem[]>()
      for (const r of itemRows) {
        const list = byLoot.get(r.loot_id) ?? []
        list.push({ itemId: r.item_id, quantity: Number(r.quantity) })
        byLoot.set(r.loot_id, list)
      }
      return rows.map((row) => rowToLoot(row, byLoot.get(row.id) ?? []))
    } finally {
      conn.release()
    }
  }

  /**
   * Claim a pile for one character.
   *
   * The UPDATE is the race: only the caller whose statement changes a row has
   * the pile, so two players reaching for it at once cannot both be granted its
   * contents. The items are returned with the claim so the caller does not have
   * to read them separately and risk reading a different pile's state.
   *
   * @returns the claimed pile, or null when it was already gone
   */
  async claim(lootId: string, characterId: string): Promise<GroundLootRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_ground_loot
            SET status = 'picked_up',
                picked_up_by_character_id = ?,
                picked_up_at = NOW(3)
          WHERE id = ?
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW(3))`,
        [characterId, lootId],
      )
      if (result.affectedRows === 0) return null
    } finally {
      conn.release()
    }
    return this.findById(lootId)
  }

  /**
   * Put a claimed pile back on the ground.
   *
   * Used when the grant that followed a claim failed — the pile has to reappear
   * or its contents are lost. Scoped to the claimant so it cannot revive a pile
   * somebody else has since taken.
   *
   * @returns true when the pile was returned
   */
  async release(lootId: string, characterId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_ground_loot
            SET status = 'active',
                picked_up_by_character_id = NULL,
                picked_up_at = NULL
          WHERE id = ? AND status = 'picked_up' AND picked_up_by_character_id = ?`,
        [lootId, characterId],
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  /**
   * Mark piles past their expiry as expired.
   * @returns how many were swept
   */
  async expireStale(): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_ground_loot
            SET status = 'expired'
          WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= NOW(3)`,
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
