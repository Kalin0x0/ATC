import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { WorldIntegrityPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateReconciliationError, ReconciliationNotFoundError } from './errors.js'

export type AtcReconciliationType = 'delta_sync' | 'full_sync' | 'conflict_resolve' | 'merge' | 'rollback' | 'custom'
export type AtcReconciliationStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcWorldReconciliation {
  id: string
  reconciliationId: string
  reconciliationType: AtcReconciliationType
  status: AtcReconciliationStatus
  ownerServerId: string
  reconciliationNonce: string
  reconciliationData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateReconciliationParams {
  reconciliationType: AtcReconciliationType
  ownerServerId: string
  reconciliationNonce: string
  reconciliationData?: Record<string, unknown> | undefined
}

interface WorldReconciliationRow extends RowDataPacket {
  id: string
  reconciliation_id: string
  reconciliation_type: string
  status: string
  owner_server_id: string
  reconciliation_nonce: string
  reconciliation_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: WorldReconciliationRow): AtcWorldReconciliation {
  let reconciliationData: Record<string, unknown> = {}
  if (row.reconciliation_data) {
    try {
      reconciliationData = JSON.parse(row.reconciliation_data) as Record<string, unknown>
    } catch {
      reconciliationData = {}
    }
  }
  return {
    id: row.id,
    reconciliationId: row.reconciliation_id,
    reconciliationType: row.reconciliation_type as AtcReconciliationType,
    status: row.status as AtcReconciliationStatus,
    ownerServerId: row.owner_server_id,
    reconciliationNonce: row.reconciliation_nonce,
    reconciliationData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class WorldReconciliationRepository {
  constructor(private readonly pool: WorldIntegrityPool) {}

  async create(params: CreateReconciliationParams): Promise<AtcWorldReconciliation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const reconciliationId = generateId()
      const reconciliationDataJson = JSON.stringify(params.reconciliationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_world_reconciliation
             (id, reconciliation_id, reconciliation_type, status, owner_server_id,
              reconciliation_nonce, reconciliation_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            reconciliationId,
            params.reconciliationType,
            params.ownerServerId,
            params.reconciliationNonce,
            reconciliationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateReconciliationError(params.reconciliationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<WorldReconciliationRow[]>(
        `SELECT id, reconciliation_id, reconciliation_type, status, owner_server_id,
                reconciliation_nonce, reconciliation_data, completed_at, created_at, updated_at
         FROM atc_world_reconciliation
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`World reconciliation record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcWorldReconciliation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorldReconciliationRow[]>(
        `SELECT id, reconciliation_id, reconciliation_type, status, owner_server_id,
                reconciliation_nonce, reconciliation_data, completed_at, created_at, updated_at
         FROM atc_world_reconciliation
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByReconciliationId(reconciliationId: string): Promise<AtcWorldReconciliation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorldReconciliationRow[]>(
        `SELECT id, reconciliation_id, reconciliation_type, status, owner_server_id,
                reconciliation_nonce, reconciliation_data, completed_at, created_at, updated_at
         FROM atc_world_reconciliation
         WHERE reconciliation_id = ?
         LIMIT 1`,
        [reconciliationId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcReconciliationStatus,
    completedAt?: Date | undefined
  ): Promise<AtcWorldReconciliation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<WorldReconciliationRow[]>(
          `SELECT id, reconciliation_id, reconciliation_type, status, owner_server_id,
                  reconciliation_nonce, reconciliation_data, completed_at, created_at, updated_at
           FROM atc_world_reconciliation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ReconciliationNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_world_reconciliation
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              completedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_world_reconciliation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<WorldReconciliationRow[]>(
          `SELECT id, reconciliation_id, reconciliation_type, status, owner_server_id,
                  reconciliation_nonce, reconciliation_data, completed_at, created_at, updated_at
           FROM atc_world_reconciliation
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ReconciliationNotFoundError(id)

        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_world_reconciliation
         WHERE status IN ('completed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
