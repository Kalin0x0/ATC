import type { RowDataPacket } from 'mysql2/promise'
import type { DisasterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  EvacuationNotFoundError,
  DuplicateEvacuationNonceError,
} from './errors.js'

export type AtcEvacuationStatus = 'initiated' | 'in_progress' | 'completed' | 'cancelled'

export interface AtcEvacuationRuntime {
  id: string
  evacuationId: string
  evacuationNonce: string
  disasterId: string | null
  zoneId: string
  evacuationType: string
  evacuatedCount: number
  targetCount: number | null
  status: AtcEvacuationStatus
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface EvacuationRuntimeRow extends RowDataPacket {
  id: string
  evacuation_id: string
  evacuation_nonce: string
  disaster_id: string | null
  zone_id: string
  evacuation_type: string
  evacuated_count: number
  target_count: number | null
  status: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToEvacuationRuntime(row: EvacuationRuntimeRow): AtcEvacuationRuntime {
  return {
    id: row.id,
    evacuationId: row.evacuation_id,
    evacuationNonce: row.evacuation_nonce,
    disasterId: row.disaster_id,
    zoneId: row.zone_id,
    evacuationType: row.evacuation_type,
    evacuatedCount: Number(row.evacuated_count),
    targetCount: row.target_count !== null ? Number(row.target_count) : null,
    status: row.status as AtcEvacuationStatus,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateEvacuationParams {
  evacuationNonce: string
  disasterId?: string | undefined
  zoneId: string
  evacuationType: string
  targetCount?: number | undefined
}

export class EvacuationRuntimeRepository {
  constructor(private readonly pool: DisasterRuntimePool) {}

  async findById(evacuationId: string): Promise<AtcEvacuationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EvacuationRuntimeRow[]>(
        `SELECT * FROM atc_evacuation_runtime WHERE evacuation_id = ? LIMIT 1`,
        [evacuationId],
      )
      return rows[0] ? rowToEvacuationRuntime(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByDisaster(disasterId: string): Promise<AtcEvacuationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EvacuationRuntimeRow[]>(
        `SELECT * FROM atc_evacuation_runtime WHERE disaster_id = ? ORDER BY created_at DESC`,
        [disasterId],
      )
      return rows.map(rowToEvacuationRuntime)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcEvacuationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EvacuationRuntimeRow[]>(
        `SELECT * FROM atc_evacuation_runtime
         WHERE status IN ('initiated', 'in_progress')
         ORDER BY created_at DESC`,
      )
      return rows.map(rowToEvacuationRuntime)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateEvacuationParams): Promise<AtcEvacuationRuntime> {
    const id = generateId()
    const evacuationId = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_evacuation_runtime
             (id, evacuation_id, evacuation_nonce, disaster_id, zone_id, evacuation_type,
              evacuated_count, target_count, status, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'initiated', NULL, NOW(3), NOW(3))`,
          [
            id,
            evacuationId,
            params.evacuationNonce,
            params.disasterId ?? null,
            params.zoneId,
            params.evacuationType,
            params.targetCount ?? null,
          ] as (string | number | boolean | null)[],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateEvacuationNonceError(params.evacuationNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<EvacuationRuntimeRow[]>(
        `SELECT * FROM atc_evacuation_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new EvacuationNotFoundError(evacuationId)
      return rowToEvacuationRuntime(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateProgress(evacuationId: string, evacuatedCount: number): Promise<AtcEvacuationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<EvacuationRuntimeRow[]>(
          `SELECT * FROM atc_evacuation_runtime WHERE evacuation_id = ? LIMIT 1 FOR UPDATE`,
          [evacuationId],
        )
        if (!rows[0]) {
          await conn.rollback()
          throw new EvacuationNotFoundError(evacuationId)
        }
        await conn.execute(
          `UPDATE atc_evacuation_runtime
           SET evacuated_count = ?, updated_at = NOW(3)
           WHERE evacuation_id = ?`,
          [evacuatedCount, evacuationId] as (string | number | boolean | null)[],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [updated] = await conn.execute<EvacuationRuntimeRow[]>(
        `SELECT * FROM atc_evacuation_runtime WHERE evacuation_id = ? LIMIT 1`,
        [evacuationId],
      )
      if (!updated[0]) throw new EvacuationNotFoundError(evacuationId)
      return rowToEvacuationRuntime(updated[0])
    } finally {
      conn.release()
    }
  }

  async transition(evacuationId: string, status: AtcEvacuationStatus): Promise<AtcEvacuationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<EvacuationRuntimeRow[]>(
          `SELECT * FROM atc_evacuation_runtime WHERE evacuation_id = ? LIMIT 1 FOR UPDATE`,
          [evacuationId],
        )
        if (!rows[0]) {
          await conn.rollback()
          throw new EvacuationNotFoundError(evacuationId)
        }

        const completedAtClause = status === 'completed' ? ', completed_at = NOW(3)' : ''

        await conn.execute(
          `UPDATE atc_evacuation_runtime
           SET status = ? ${completedAtClause}, updated_at = NOW(3)
           WHERE evacuation_id = ?`,
          [status, evacuationId] as (string | number | boolean | null)[],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [updated] = await conn.execute<EvacuationRuntimeRow[]>(
        `SELECT * FROM atc_evacuation_runtime WHERE evacuation_id = ? LIMIT 1`,
        [evacuationId],
      )
      if (!updated[0]) throw new EvacuationNotFoundError(evacuationId)
      return rowToEvacuationRuntime(updated[0])
    } finally {
      conn.release()
    }
  }
}
