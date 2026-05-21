import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ContinuityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { TemporalIntegrityNotFoundError } from './errors.js'

export type AtcTemporalIntegrityType = 'timestamp' | 'epoch' | 'sequence' | 'hash' | 'custom'
export type AtcTemporalIntegrityStatus = 'valid' | 'violated' | 'repaired' | 'unknown'

export interface AtcTemporalIntegrity {
  id: string
  integrityId: string
  integrityType: AtcTemporalIntegrityType
  status: AtcTemporalIntegrityStatus
  ownerServerId: string
  integrityNonce: string
  integrityData: Record<string, unknown>
  repairedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateTemporalIntegrityParams {
  integrityType: AtcTemporalIntegrityType
  ownerServerId: string
  integrityNonce: string
  integrityData?: Record<string, unknown> | undefined
}

interface TemporalIntegrityRow extends RowDataPacket {
  id: string
  integrity_id: string
  integrity_type: string
  status: string
  owner_server_id: string
  integrity_nonce: string
  integrity_data: string | null
  repaired_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: TemporalIntegrityRow): AtcTemporalIntegrity {
  let integrityData: Record<string, unknown> = {}
  if (row.integrity_data) {
    try {
      integrityData = JSON.parse(row.integrity_data) as Record<string, unknown>
    } catch {
      integrityData = {}
    }
  }
  return {
    id: row.id,
    integrityId: row.integrity_id,
    integrityType: row.integrity_type as AtcTemporalIntegrityType,
    status: row.status as AtcTemporalIntegrityStatus,
    ownerServerId: row.owner_server_id,
    integrityNonce: row.integrity_nonce,
    integrityData,
    repairedAt: row.repaired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TemporalIntegrityRepository {
  constructor(private readonly pool: ContinuityRuntimePool) {}

  async create(params: CreateTemporalIntegrityParams): Promise<AtcTemporalIntegrity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const integrityId = generateId()
      const integrityDataJson = JSON.stringify(params.integrityData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_temporal_integrity
           (id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
            integrity_data, repaired_at, created_at, updated_at)
         VALUES (?, ?, ?, 'unknown', ?, ?, ?, NULL, NOW(3), NOW(3))`,
        [
          id,
          integrityId,
          params.integrityType,
          params.ownerServerId,
          params.integrityNonce,
          integrityDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<TemporalIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                integrity_data, repaired_at, created_at, updated_at
         FROM atc_temporal_integrity
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Temporal integrity record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTemporalIntegrity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TemporalIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                integrity_data, repaired_at, created_at, updated_at
         FROM atc_temporal_integrity
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
    status: AtcTemporalIntegrityStatus,
    repairedAt?: Date | undefined
  ): Promise<AtcTemporalIntegrity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<TemporalIntegrityRow[]>(
          `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                  integrity_data, repaired_at, created_at, updated_at
           FROM atc_temporal_integrity
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new TemporalIntegrityNotFoundError(id)

        if (repairedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_temporal_integrity
             SET status = ?, repaired_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              repairedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_temporal_integrity
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<TemporalIntegrityRow[]>(
          `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                  integrity_data, repaired_at, created_at, updated_at
           FROM atc_temporal_integrity
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new TemporalIntegrityNotFoundError(id)

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
        `DELETE FROM atc_temporal_integrity
         WHERE status IN ('repaired', 'valid')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
