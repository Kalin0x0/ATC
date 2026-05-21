import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GlobalGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { ArbitrationNotFoundError } from './errors.js'

export type AtcArbitrationType = 'conflict' | 'resource' | 'authority' | 'policy' | 'custom'
export type AtcArbitrationStatus = 'pending' | 'arbitrating' | 'resolved' | 'rejected' | 'escalated'

export interface AtcCrossSystemArbitration {
  id: string
  arbitrationId: string
  arbitrationType: AtcArbitrationType
  status: AtcArbitrationStatus
  ownerServerId: string
  arbitrationNonce: string
  arbitrationData: Record<string, unknown>
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateArbitrationParams {
  arbitrationType: AtcArbitrationType
  ownerServerId: string
  arbitrationNonce: string
  arbitrationData?: Record<string, unknown> | undefined
}

interface CrossSystemArbitrationRow extends RowDataPacket {
  id: string
  arbitration_id: string
  arbitration_type: string
  status: string
  owner_server_id: string
  arbitration_nonce: string
  arbitration_data: string | null
  resolved_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: CrossSystemArbitrationRow): AtcCrossSystemArbitration {
  let arbitrationData: Record<string, unknown> = {}
  if (row.arbitration_data) {
    try {
      arbitrationData = JSON.parse(row.arbitration_data) as Record<string, unknown>
    } catch {
      arbitrationData = {}
    }
  }
  return {
    id: row.id,
    arbitrationId: row.arbitration_id,
    arbitrationType: row.arbitration_type as AtcArbitrationType,
    status: row.status as AtcArbitrationStatus,
    ownerServerId: row.owner_server_id,
    arbitrationNonce: row.arbitration_nonce,
    arbitrationData,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CrossSystemArbitrationRepository {
  constructor(private readonly pool: GlobalGovernancePool) {}

  async create(params: CreateArbitrationParams): Promise<AtcCrossSystemArbitration> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const arbitrationId = generateId()
      const arbitrationDataJson = JSON.stringify(params.arbitrationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_crosssystem_arbitration
           (id, arbitration_id, arbitration_type, status, owner_server_id, arbitration_nonce,
            arbitration_data, resolved_at, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
        [
          id,
          arbitrationId,
          params.arbitrationType,
          params.ownerServerId,
          params.arbitrationNonce,
          arbitrationDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<CrossSystemArbitrationRow[]>(
        `SELECT id, arbitration_id, arbitration_type, status, owner_server_id, arbitration_nonce,
                arbitration_data, resolved_at, created_at, updated_at
         FROM atc_crosssystem_arbitration
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Cross-system arbitration record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCrossSystemArbitration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CrossSystemArbitrationRow[]>(
        `SELECT id, arbitration_id, arbitration_type, status, owner_server_id, arbitration_nonce,
                arbitration_data, resolved_at, created_at, updated_at
         FROM atc_crosssystem_arbitration
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
    status: AtcArbitrationStatus,
    resolvedAt?: Date | undefined
  ): Promise<AtcCrossSystemArbitration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<CrossSystemArbitrationRow[]>(
          `SELECT id, arbitration_id, arbitration_type, status, owner_server_id, arbitration_nonce,
                  arbitration_data, resolved_at, created_at, updated_at
           FROM atc_crosssystem_arbitration
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ArbitrationNotFoundError(id)

        if (resolvedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_crosssystem_arbitration
             SET status = ?, resolved_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              resolvedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_crosssystem_arbitration
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<CrossSystemArbitrationRow[]>(
          `SELECT id, arbitration_id, arbitration_type, status, owner_server_id, arbitration_nonce,
                  arbitration_data, resolved_at, created_at, updated_at
           FROM atc_crosssystem_arbitration
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ArbitrationNotFoundError(id)

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
        `DELETE FROM atc_crosssystem_arbitration
         WHERE status IN ('resolved', 'rejected', 'escalated')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
