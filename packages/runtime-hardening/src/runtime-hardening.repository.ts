import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeHardeningPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateHardeningError, HardeningNotFoundError } from './errors.js'

export type AtcHardeningType = 'immutable' | 'encrypted' | 'verified' | 'sealed' | 'custom'
export type AtcHardeningStatus = 'pending' | 'hardening' | 'hardened' | 'violated' | 'failed'

export interface AtcRuntimeHardening {
  id: string
  hardeningId: string
  hardeningType: AtcHardeningType
  status: AtcHardeningStatus
  ownerServerId: string
  hardeningNonce: string
  hardeningData: Record<string, unknown>
  hardenedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateHardeningParams {
  hardeningType: AtcHardeningType
  ownerServerId: string
  hardeningNonce: string
  hardeningData?: Record<string, unknown> | undefined
}

interface RuntimeHardeningRow extends RowDataPacket {
  id: string
  hardening_id: string
  hardening_type: string
  status: string
  owner_server_id: string
  hardening_nonce: string
  hardening_data: string | null
  hardened_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeHardeningRow): AtcRuntimeHardening {
  let hardeningData: Record<string, unknown> = {}
  if (row.hardening_data) {
    try {
      hardeningData = JSON.parse(row.hardening_data) as Record<string, unknown>
    } catch {
      hardeningData = {}
    }
  }
  return {
    id: row.id,
    hardeningId: row.hardening_id,
    hardeningType: row.hardening_type as AtcHardeningType,
    status: row.status as AtcHardeningStatus,
    ownerServerId: row.owner_server_id,
    hardeningNonce: row.hardening_nonce,
    hardeningData,
    hardenedAt: row.hardened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeHardeningRepository {
  constructor(private readonly pool: RuntimeHardeningPool) {}

  async create(params: CreateHardeningParams): Promise<AtcRuntimeHardening> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const hardeningId = generateId()
      const hardeningDataJson = JSON.stringify(params.hardeningData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_hardening
             (id, hardening_id, hardening_type, status, owner_server_id, hardening_nonce,
              hardening_data, hardened_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            hardeningId,
            params.hardeningType,
            params.ownerServerId,
            params.hardeningNonce,
            hardeningDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateHardeningError(params.hardeningNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeHardeningRow[]>(
        `SELECT id, hardening_id, hardening_type, status, owner_server_id, hardening_nonce,
                hardening_data, hardened_at, created_at, updated_at
         FROM atc_runtime_hardening
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) throw new Error(`Runtime hardening record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeHardening | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeHardeningRow[]>(
        `SELECT id, hardening_id, hardening_type, status, owner_server_id, hardening_nonce,
                hardening_data, hardened_at, created_at, updated_at
         FROM atc_runtime_hardening
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcHardeningStatus,
    hardenedAt?: Date | undefined
  ): Promise<AtcRuntimeHardening> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeHardeningRow[]>(
          `SELECT id, hardening_id, hardening_type, status, owner_server_id, hardening_nonce,
                  hardening_data, hardened_at, created_at, updated_at
           FROM atc_runtime_hardening
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as (string | number | boolean | null)[]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new HardeningNotFoundError(id)

        if (hardenedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_hardening
             SET status = ?, hardened_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              hardenedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_hardening
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeHardeningRow[]>(
          `SELECT id, hardening_id, hardening_type, status, owner_server_id, hardening_nonce,
                  hardening_data, hardened_at, created_at, updated_at
           FROM atc_runtime_hardening
           WHERE id = ?
           LIMIT 1`,
          [id] as (string | number | boolean | null)[]
        )
        const row = rows[0]
        if (!row) throw new HardeningNotFoundError(id)

        await conn.commit()
        return mapRow(row)
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
        `DELETE FROM atc_runtime_hardening
         WHERE status IN ('violated', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as (string | number | boolean | null)[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
