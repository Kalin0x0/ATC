import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreClosurePool } from './pool.js'
import { generateId } from './id.js'
import { RuntimeImmutabilityNotFoundError, DuplicateRuntimeImmutabilityError } from './errors.js'

export type AtcImmutabilityType = 'full' | 'partial' | 'runtime' | 'data' | 'custom'
export type AtcImmutabilityStatus = 'pending' | 'active' | 'frozen' | 'violated' | 'failed'

export interface AtcRuntimeImmutability {
  id: string
  immutabilityId: string
  immutabilityType: AtcImmutabilityType
  status: AtcImmutabilityStatus
  ownerServerId: string
  immutabilityNonce: string
  immutabilityData: Record<string, unknown>
  frozenAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateImmutabilityParams {
  immutabilityType: AtcImmutabilityType
  ownerServerId: string
  immutabilityNonce: string
  immutabilityData?: Record<string, unknown> | undefined
}

interface RuntimeImmutabilityRow extends RowDataPacket {
  id: string
  immutability_id: string
  immutability_type: string
  status: string
  owner_server_id: string
  immutability_nonce: string
  immutability_data: string | null
  frozen_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeImmutabilityRow): AtcRuntimeImmutability {
  let immutabilityData: Record<string, unknown> = {}
  if (row.immutability_data) {
    try {
      immutabilityData = JSON.parse(row.immutability_data) as Record<string, unknown>
    } catch {
      immutabilityData = {}
    }
  }
  return {
    id: row.id,
    immutabilityId: row.immutability_id,
    immutabilityType: row.immutability_type as AtcImmutabilityType,
    status: row.status as AtcImmutabilityStatus,
    ownerServerId: row.owner_server_id,
    immutabilityNonce: row.immutability_nonce,
    immutabilityData,
    frozenAt: row.frozen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeImmutabilityRepository {
  constructor(private readonly pool: CoreClosurePool) {}

  async create(params: CreateImmutabilityParams): Promise<AtcRuntimeImmutability> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const immutabilityId = generateId()
      const immutabilityDataJson = JSON.stringify(params.immutabilityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_immutability
             (id, immutability_id, immutability_type, status, owner_server_id,
              immutability_nonce, immutability_data, frozen_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            immutabilityId,
            params.immutabilityType,
            params.ownerServerId,
            params.immutabilityNonce,
            immutabilityDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateRuntimeImmutabilityError(params.immutabilityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeImmutabilityRow[]>(
        `SELECT id, immutability_id, immutability_type, status, owner_server_id,
                immutability_nonce, immutability_data, frozen_at, created_at, updated_at
         FROM atc_runtime_immutability
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Runtime immutability not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeImmutability | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeImmutabilityRow[]>(
        `SELECT id, immutability_id, immutability_type, status, owner_server_id,
                immutability_nonce, immutability_data, frozen_at, created_at, updated_at
         FROM atc_runtime_immutability
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcImmutabilityStatus,
    frozenAt?: Date | undefined
  ): Promise<AtcRuntimeImmutability> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeImmutabilityRow[]>(
          `SELECT id, immutability_id, immutability_type, status, owner_server_id,
                  immutability_nonce, immutability_data, frozen_at, created_at, updated_at
           FROM atc_runtime_immutability
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new RuntimeImmutabilityNotFoundError(id)

        if (frozenAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_immutability
             SET status = ?, frozen_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, frozenAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_immutability
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<RuntimeImmutabilityRow[]>(
          `SELECT id, immutability_id, immutability_type, status, owner_server_id,
                  immutability_nonce, immutability_data, frozen_at, created_at, updated_at
           FROM atc_runtime_immutability
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new RuntimeImmutabilityNotFoundError(id)

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
        `DELETE FROM atc_runtime_immutability
         WHERE status IN ('violated', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
