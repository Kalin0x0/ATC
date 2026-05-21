import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreFinalizationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateDeterministicSealingError, DeterministicSealingNotFoundError } from './errors.js'

export type AtcDeterministicSealingType = 'hash' | 'merkle' | 'signature' | 'epoch' | 'custom'
export type AtcDeterministicSealingStatus = 'pending' | 'sealing' | 'sealed' | 'broken' | 'expired'

export interface AtcDeterministicSealing {
  id: string
  sealingId: string
  sealingType: AtcDeterministicSealingType
  status: AtcDeterministicSealingStatus
  ownerServerId: string
  sealingNonce: string
  sealingData: Record<string, unknown>
  sealedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDeterministicSealingParams {
  sealingType: AtcDeterministicSealingType
  ownerServerId: string
  sealingNonce: string
  sealingData?: Record<string, unknown> | undefined
}

interface DeterministicSealingRow extends RowDataPacket {
  id: string
  sealing_id: string
  sealing_type: string
  status: string
  owner_server_id: string
  sealing_nonce: string
  sealing_data: string | null
  sealed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DeterministicSealingRow): AtcDeterministicSealing {
  let sealingData: Record<string, unknown> = {}
  if (row.sealing_data) {
    try {
      sealingData = JSON.parse(row.sealing_data) as Record<string, unknown>
    } catch {
      sealingData = {}
    }
  }
  return {
    id: row.id,
    sealingId: row.sealing_id,
    sealingType: row.sealing_type as AtcDeterministicSealingType,
    status: row.status as AtcDeterministicSealingStatus,
    ownerServerId: row.owner_server_id,
    sealingNonce: row.sealing_nonce,
    sealingData,
    sealedAt: row.sealed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DeterministicSealingRepository {
  constructor(private readonly pool: CoreFinalizationPool) {}

  async create(params: CreateDeterministicSealingParams): Promise<AtcDeterministicSealing> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sealingId = generateId()
      const sealingDataJson = JSON.stringify(params.sealingData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_deterministic_sealing
             (id, sealing_id, sealing_type, status, owner_server_id, sealing_nonce,
              sealing_data, sealed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            sealingId,
            params.sealingType,
            params.ownerServerId,
            params.sealingNonce,
            sealingDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateDeterministicSealingError(params.sealingNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<DeterministicSealingRow[]>(
        `SELECT id, sealing_id, sealing_type, status, owner_server_id, sealing_nonce,
                sealing_data, sealed_at, created_at, updated_at
         FROM atc_deterministic_sealing
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Deterministic sealing record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDeterministicSealing | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DeterministicSealingRow[]>(
        `SELECT id, sealing_id, sealing_type, status, owner_server_id, sealing_nonce,
                sealing_data, sealed_at, created_at, updated_at
         FROM atc_deterministic_sealing
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
    status: AtcDeterministicSealingStatus,
    sealedAt?: Date | undefined
  ): Promise<AtcDeterministicSealing> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DeterministicSealingRow[]>(
          `SELECT id, sealing_id, sealing_type, status, owner_server_id, sealing_nonce,
                  sealing_data, sealed_at, created_at, updated_at
           FROM atc_deterministic_sealing
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new DeterministicSealingNotFoundError(id)

        if (sealedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_deterministic_sealing
             SET status = ?, sealed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              sealedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_deterministic_sealing
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<DeterministicSealingRow[]>(
          `SELECT id, sealing_id, sealing_type, status, owner_server_id, sealing_nonce,
                  sealing_data, sealed_at, created_at, updated_at
           FROM atc_deterministic_sealing
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new DeterministicSealingNotFoundError(id)

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
        `DELETE FROM atc_deterministic_sealing
         WHERE status IN ('broken', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
