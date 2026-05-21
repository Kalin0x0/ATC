import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SovereigntyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateSuccessionError, SuccessionNotFoundError } from './errors.js'

export type AtcSuccessionType = 'planned' | 'emergency' | 'failover' | 'upgrade' | 'custom'
export type AtcSuccessionStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'reverted'

export interface AtcRuntimeSuccession {
  id: string
  successionId: string
  successionType: AtcSuccessionType
  status: AtcSuccessionStatus
  ownerServerId: string
  targetServerId: string | null
  successionNonce: string
  successionData: Record<string, unknown>
  transferredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSuccessionParams {
  successionType: AtcSuccessionType
  ownerServerId: string
  successionNonce: string
  targetServerId?: string | undefined
  successionData?: Record<string, unknown> | undefined
}

interface RuntimeSuccessionRow extends RowDataPacket {
  id: string
  succession_id: string
  succession_type: string
  status: string
  owner_server_id: string
  target_server_id: string | null
  succession_nonce: string
  succession_data: string | null
  transferred_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeSuccessionRow): AtcRuntimeSuccession {
  let successionData: Record<string, unknown> = {}
  if (row.succession_data) {
    try {
      successionData = JSON.parse(row.succession_data) as Record<string, unknown>
    } catch {
      successionData = {}
    }
  }
  return {
    id: row.id,
    successionId: row.succession_id,
    successionType: row.succession_type as AtcSuccessionType,
    status: row.status as AtcSuccessionStatus,
    ownerServerId: row.owner_server_id,
    targetServerId: row.target_server_id,
    successionNonce: row.succession_nonce,
    successionData,
    transferredAt: row.transferred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeSuccessionRepository {
  constructor(private readonly pool: SovereigntyRuntimePool) {}

  async create(params: CreateSuccessionParams): Promise<AtcRuntimeSuccession> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const successionId = generateId()
      const successionDataJson = JSON.stringify(params.successionData ?? {})
      const targetServerId = params.targetServerId ?? null

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_succession
             (id, succession_id, succession_type, status, owner_server_id, target_server_id,
              succession_nonce, succession_data, transferred_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            successionId,
            params.successionType,
            params.ownerServerId,
            targetServerId,
            params.successionNonce,
            successionDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateSuccessionError(params.successionNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeSuccessionRow[]>(
        `SELECT id, succession_id, succession_type, status, owner_server_id, target_server_id,
                succession_nonce, succession_data, transferred_at, created_at, updated_at
         FROM atc_runtime_succession
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime succession record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeSuccession | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeSuccessionRow[]>(
        `SELECT id, succession_id, succession_type, status, owner_server_id, target_server_id,
                succession_nonce, succession_data, transferred_at, created_at, updated_at
         FROM atc_runtime_succession
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

  async updateStatus(
    id: string,
    status: AtcSuccessionStatus,
    transferredAt?: Date | undefined
  ): Promise<AtcRuntimeSuccession> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeSuccessionRow[]>(
          `SELECT id, succession_id, succession_type, status, owner_server_id, target_server_id,
                  succession_nonce, succession_data, transferred_at, created_at, updated_at
           FROM atc_runtime_succession
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new SuccessionNotFoundError(id)

        if (transferredAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_succession
             SET status = ?, transferred_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              transferredAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_succession
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeSuccessionRow[]>(
          `SELECT id, succession_id, succession_type, status, owner_server_id, target_server_id,
                  succession_nonce, succession_data, transferred_at, created_at, updated_at
           FROM atc_runtime_succession
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new SuccessionNotFoundError(id)

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
        `DELETE FROM atc_runtime_succession
         WHERE status IN ('completed', 'failed', 'reverted')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
