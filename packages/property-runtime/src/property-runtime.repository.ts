import type { RowDataPacket } from 'mysql2/promise'
import type { AtcPropertyRuntime, AtcPropertyOccupant } from '@atc/shared-types'
import type { PropertyPool } from './pool.js'
import { generateId } from './id.js'
import { PropertyRuntimeNotFoundError } from './errors.js'

interface RuntimeRow extends RowDataPacket {
  id: string
  property_id: string
  is_online: number
  occupant_count: number
  breach_started_at: Date | null
  breach_by_principal_id: string | null
  breach_reason: string | null
  last_activity_at: Date
  created_at: Date
}

interface OccupantRow extends RowDataPacket {
  id: string
  property_id: string
  principal_id: string
  entered_at: Date
  exited_at: Date | null
}

function rowToRuntime(row: RuntimeRow): AtcPropertyRuntime {
  return {
    id: row.id,
    propertyId: row.property_id,
    isOnline: row.is_online === 1,
    occupantCount: row.occupant_count,
    breachStartedAt: row.breach_started_at,
    breachByPrincipalId: row.breach_by_principal_id,
    breachReason: row.breach_reason,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
  }
}

function rowToOccupant(row: OccupantRow): AtcPropertyOccupant {
  return {
    id: row.id,
    propertyId: row.property_id,
    principalId: row.principal_id,
    enteredAt: row.entered_at,
    exitedAt: row.exited_at,
  }
}

export class PropertyRuntimeRepository {
  constructor(private readonly pool: PropertyPool) {}

  async upsertRuntime(propertyId: string): Promise<AtcPropertyRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_property_runtime
           (id, property_id, is_online, occupant_count, last_activity_at, created_at)
         VALUES (?, ?, 0, 0, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE last_activity_at = NOW(3)`,
        [id, propertyId],
      )
      const runtime = await this.findByProperty(propertyId)
      if (!runtime) throw new PropertyRuntimeNotFoundError(propertyId)
      return runtime
    } finally {
      conn.release()
    }
  }

  async setBreach(
    propertyId: string,
    breachByPrincipalId: string | null,
    breachReason: string | null,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_property_runtime
         SET breach_started_at = CASE WHEN ? IS NOT NULL THEN NOW(3) ELSE NULL END,
             breach_by_principal_id = ?,
             breach_reason = ?,
             last_activity_at = NOW(3)
         WHERE property_id = ?`,
        [breachByPrincipalId, breachByPrincipalId, breachReason, propertyId],
      )
    } finally {
      conn.release()
    }
  }

  async findByProperty(propertyId: string): Promise<AtcPropertyRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeRow[]>(
        `SELECT * FROM atc_property_runtime WHERE property_id = ? LIMIT 1`,
        [propertyId],
      )
      return rows[0] ? rowToRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  // ── Occupant tracking ─────────────────────────────────────────────────────────

  async enter(propertyId: string, principalId: string): Promise<AtcPropertyOccupant> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        await conn.execute(
          `INSERT INTO atc_property_occupants (id, property_id, principal_id, entered_at)
           VALUES (?, ?, ?, NOW(3))`,
          [id, propertyId, principalId],
        )
        await conn.execute(
          `UPDATE atc_property_runtime
           SET occupant_count = occupant_count + 1,
               is_online = 1,
               last_activity_at = NOW(3)
           WHERE property_id = ?`,
          [propertyId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<OccupantRow[]>(
        `SELECT * FROM atc_property_occupants WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PropertyRuntimeNotFoundError(propertyId)
      return rowToOccupant(rows[0])
    } finally {
      conn.release()
    }
  }

  async exit(propertyId: string, principalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        await conn.execute(
          `UPDATE atc_property_occupants
           SET exited_at = NOW(3)
           WHERE property_id = ? AND principal_id = ? AND exited_at IS NULL
           ORDER BY entered_at DESC LIMIT 1`,
          [propertyId, principalId],
        )
        await conn.execute(
          `UPDATE atc_property_runtime
           SET occupant_count = GREATEST(0, occupant_count - 1),
               is_online = CASE WHEN occupant_count - 1 <= 0 THEN 0 ELSE 1 END,
               last_activity_at = NOW(3)
           WHERE property_id = ?`,
          [propertyId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listActiveOccupants(propertyId: string): Promise<AtcPropertyOccupant[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OccupantRow[]>(
        `SELECT * FROM atc_property_occupants
         WHERE property_id = ? AND exited_at IS NULL
         ORDER BY entered_at ASC`,
        [propertyId],
      )
      return rows.map(rowToOccupant)
    } finally {
      conn.release()
    }
  }

  async evictAllOccupants(propertyId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        await conn.execute(
          `UPDATE atc_property_occupants
           SET exited_at = NOW(3)
           WHERE property_id = ? AND exited_at IS NULL`,
          [propertyId],
        )
        await conn.execute(
          `UPDATE atc_property_runtime
           SET occupant_count = 0, is_online = 0, last_activity_at = NOW(3)
           WHERE property_id = ?`,
          [propertyId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanStaleOccupants(olderThanMinutes: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<RowDataPacket[]>(
        `UPDATE atc_property_occupants
         SET exited_at = NOW(3)
         WHERE exited_at IS NULL
           AND entered_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
        [olderThanMinutes],
      )
      return (result as unknown as { affectedRows: number }).affectedRows ?? 0
    } finally {
      conn.release()
    }
  }
}
