import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { HousingEconomyPool } from './pool.js'
import { generateId } from './id.js'
import {
  ForeclosureNotFoundError,
  ForeclosureAlreadyActiveError,
  ForeclosureCompletedError,
} from './errors.js'

export type AtcForeclosureStatus = 'initiated' | 'pending' | 'completed' | 'cancelled'

export interface AtcForeclosure {
  id: string
  propertyId: string
  contractId: string | null
  initiatedByPrincipalId: string
  status: AtcForeclosureStatus
  reason: string
  foreclosureNonce: string
  initiatedAt: Date
  completedAt: Date | null
  cancelledAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface StartForeclosureParams {
  propertyId: string
  contractId?: string | null | undefined
  initiatedByPrincipalId: string
  reason: string
  foreclosureNonce: string
  notes?: string | null | undefined
}

export interface TransitionForeclosureOpts {
  notes?: string | null | undefined
}

interface ForeclosureRow extends RowDataPacket {
  id: string
  property_id: string
  contract_id: string | null
  initiated_by_principal_id: string
  status: string
  reason: string
  foreclosure_nonce: string
  initiated_at: Date
  completed_at: Date | null
  cancelled_at: Date | null
  notes: string | null
  created_at: Date
  updated_at: Date
}

function rowToForeclosure(row: ForeclosureRow): AtcForeclosure {
  return {
    id: row.id,
    propertyId: row.property_id,
    contractId: row.contract_id,
    initiatedByPrincipalId: row.initiated_by_principal_id,
    status: row.status as AtcForeclosureStatus,
    reason: row.reason,
    foreclosureNonce: row.foreclosure_nonce,
    initiatedAt: row.initiated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_FORECLOSURE_TRANSITIONS: Record<AtcForeclosureStatus, AtcForeclosureStatus[]> = {
  initiated: ['pending', 'completed', 'cancelled'],
  pending: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export class ForeclosureRepository {
  constructor(private readonly pool: HousingEconomyPool) {}

  async create(params: StartForeclosureParams): Promise<AtcForeclosure> {
    const id = generateId()
    const contractId = params.contractId ?? null
    const notes = params.notes ?? null

    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_foreclosures
             (id, property_id, contract_id, initiated_by_principal_id, status, reason,
              foreclosure_nonce, initiated_at, completed_at, cancelled_at, notes,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, 'initiated', ?, ?, NOW(3), NULL, NULL, ?, NOW(3), NOW(3))`,
          [
            id,
            params.propertyId,
            contractId,
            params.initiatedByPrincipalId,
            params.reason,
            params.foreclosureNonce,
            notes,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByNonce(params.foreclosureNonce)
          if (existing) return existing
          throw new ForeclosureAlreadyActiveError(params.propertyId)
        }
        throw err
      }

      const [rows] = await conn.execute<ForeclosureRow[]>(
        'SELECT * FROM atc_foreclosures WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new ForeclosureNotFoundError(id)
      return rowToForeclosure(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcForeclosure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ForeclosureRow[]>(
        'SELECT * FROM atc_foreclosures WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToForeclosure(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByNonce(nonce: string): Promise<AtcForeclosure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ForeclosureRow[]>(
        'SELECT * FROM atc_foreclosures WHERE foreclosure_nonce = ? LIMIT 1',
        [nonce],
      )
      return rows[0] ? rowToForeclosure(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveByProperty(propertyId: string): Promise<AtcForeclosure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ForeclosureRow[]>(
        `SELECT * FROM atc_foreclosures
         WHERE property_id = ? AND status IN ('initiated', 'pending')
         ORDER BY initiated_at DESC
         LIMIT 1`,
        [propertyId],
      )
      return rows[0] ? rowToForeclosure(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(
    id: string,
    status: AtcForeclosureStatus,
    opts?: TransitionForeclosureOpts,
  ): Promise<AtcForeclosure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<ForeclosureRow[]>(
        'SELECT * FROM atc_foreclosures WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) {
        await conn.rollback()
        throw new ForeclosureNotFoundError(id)
      }

      const current = row.status as AtcForeclosureStatus
      if (current === 'completed') {
        await conn.rollback()
        throw new ForeclosureCompletedError(id)
      }

      const allowed = ALLOWED_FORECLOSURE_TRANSITIONS[current]
      if (!allowed.includes(status)) {
        await conn.rollback()
        throw new ForeclosureNotFoundError(id)
      }

      const notes = opts?.notes ?? null
      const completedAtExpr = status === 'completed' ? 'NOW(3)' : 'NULL'
      const cancelledAtExpr = status === 'cancelled' ? 'NOW(3)' : 'NULL'

      await conn.execute(
        `UPDATE atc_foreclosures
         SET status = ?,
             completed_at = ${completedAtExpr},
             cancelled_at = ${cancelledAtExpr},
             notes = COALESCE(?, notes),
             updated_at = NOW(3)
         WHERE id = ?`,
        [status, notes, id],
      )

      const [updated] = await conn.execute<ForeclosureRow[]>(
        'SELECT * FROM atc_foreclosures WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToForeclosure(updated[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async cleanStale(olderThanHours: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_foreclosures
         SET status = 'cancelled',
             cancelled_at = NOW(3),
             notes = COALESCE(notes, 'Auto-cancelled: stale'),
             updated_at = NOW(3)
         WHERE status IN ('initiated', 'pending')
           AND initiated_at < DATE_SUB(NOW(3), INTERVAL ? HOUR)`,
        [olderThanHours],
      )
      await conn.commit()
      return result.affectedRows
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }
}
