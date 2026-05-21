import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SovereigntyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateSovereigntyError, SovereigntyNotFoundError } from './errors.js'

export type AtcSovereigntyType = 'absolute' | 'delegated' | 'shared' | 'temporary' | 'custom'
export type AtcSovereigntyStatus = 'establishing' | 'established' | 'challenged' | 'revoked' | 'expired'

export interface AtcRuntimeSovereignty {
  id: string
  sovereigntyId: string
  sovereigntyType: AtcSovereigntyType
  status: AtcSovereigntyStatus
  ownerServerId: string
  sovereigntyNonce: string
  sovereigntyData: Record<string, unknown>
  establishedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSovereigntyParams {
  sovereigntyType: AtcSovereigntyType
  ownerServerId: string
  sovereigntyNonce: string
  sovereigntyData?: Record<string, unknown> | undefined
}

interface RuntimeSovereigntyRow extends RowDataPacket {
  id: string
  sovereignty_id: string
  sovereignty_type: string
  status: string
  owner_server_id: string
  sovereignty_nonce: string
  sovereignty_data: string | null
  established_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeSovereigntyRow): AtcRuntimeSovereignty {
  let sovereigntyData: Record<string, unknown> = {}
  if (row.sovereignty_data) {
    try {
      sovereigntyData = JSON.parse(row.sovereignty_data) as Record<string, unknown>
    } catch {
      sovereigntyData = {}
    }
  }
  return {
    id: row.id,
    sovereigntyId: row.sovereignty_id,
    sovereigntyType: row.sovereignty_type as AtcSovereigntyType,
    status: row.status as AtcSovereigntyStatus,
    ownerServerId: row.owner_server_id,
    sovereigntyNonce: row.sovereignty_nonce,
    sovereigntyData,
    establishedAt: row.established_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeSovereigntyRepository {
  constructor(private readonly pool: SovereigntyRuntimePool) {}

  async create(params: CreateSovereigntyParams): Promise<AtcRuntimeSovereignty> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sovereigntyId = generateId()
      const sovereigntyDataJson = JSON.stringify(params.sovereigntyData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_sovereignty
             (id, sovereignty_id, sovereignty_type, status, owner_server_id, sovereignty_nonce,
              sovereignty_data, established_at, created_at, updated_at)
           VALUES (?, ?, ?, 'establishing', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            sovereigntyId,
            params.sovereigntyType,
            params.ownerServerId,
            params.sovereigntyNonce,
            sovereigntyDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateSovereigntyError(params.sovereigntyNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeSovereigntyRow[]>(
        `SELECT id, sovereignty_id, sovereignty_type, status, owner_server_id, sovereignty_nonce,
                sovereignty_data, established_at, created_at, updated_at
         FROM atc_runtime_sovereignty
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime sovereignty record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeSovereignty | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeSovereigntyRow[]>(
        `SELECT id, sovereignty_id, sovereignty_type, status, owner_server_id, sovereignty_nonce,
                sovereignty_data, established_at, created_at, updated_at
         FROM atc_runtime_sovereignty
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
    status: AtcSovereigntyStatus,
    establishedAt?: Date | undefined
  ): Promise<AtcRuntimeSovereignty> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeSovereigntyRow[]>(
          `SELECT id, sovereignty_id, sovereignty_type, status, owner_server_id, sovereignty_nonce,
                  sovereignty_data, established_at, created_at, updated_at
           FROM atc_runtime_sovereignty
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new SovereigntyNotFoundError(id)

        if (establishedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_sovereignty
             SET status = ?, established_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              establishedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_sovereignty
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeSovereigntyRow[]>(
          `SELECT id, sovereignty_id, sovereignty_type, status, owner_server_id, sovereignty_nonce,
                  sovereignty_data, established_at, created_at, updated_at
           FROM atc_runtime_sovereignty
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new SovereigntyNotFoundError(id)

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
        `DELETE FROM atc_runtime_sovereignty
         WHERE status IN ('revoked', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
