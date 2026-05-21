import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { WorldIntegrityPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateIntegrityError, IntegrityNotFoundError } from './errors.js'

export type AtcIntegrityType = 'checkpoint' | 'snapshot' | 'hash_verify' | 'state_audit' | 'consistency_check' | 'custom'
export type AtcIntegrityStatus = 'pending' | 'active' | 'verified' | 'failed' | 'corrupted'

export interface AtcWorldIntegrity {
  id: string
  integrityId: string
  integrityType: AtcIntegrityType
  status: AtcIntegrityStatus
  ownerServerId: string
  integrityNonce: string
  worldHash: string | null
  integrityData: Record<string, unknown>
  verifiedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateIntegrityParams {
  integrityType: AtcIntegrityType
  ownerServerId: string
  integrityNonce: string
  integrityData?: Record<string, unknown> | undefined
}

interface WorldIntegrityRow extends RowDataPacket {
  id: string
  integrity_id: string
  integrity_type: string
  status: string
  owner_server_id: string
  integrity_nonce: string
  world_hash: string | null
  integrity_data: string | null
  verified_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: WorldIntegrityRow): AtcWorldIntegrity {
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
    integrityType: row.integrity_type as AtcIntegrityType,
    status: row.status as AtcIntegrityStatus,
    ownerServerId: row.owner_server_id,
    integrityNonce: row.integrity_nonce,
    worldHash: row.world_hash,
    integrityData,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class WorldIntegrityRepository {
  constructor(private readonly pool: WorldIntegrityPool) {}

  async create(params: CreateIntegrityParams): Promise<AtcWorldIntegrity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const integrityId = generateId()
      const integrityDataJson = JSON.stringify(params.integrityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_world_integrity
             (id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
              world_hash, integrity_data, verified_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, NULL, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            integrityId,
            params.integrityType,
            params.ownerServerId,
            params.integrityNonce,
            integrityDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateIntegrityError(params.integrityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<WorldIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                world_hash, integrity_data, verified_at, created_at, updated_at
         FROM atc_world_integrity
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`World integrity record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcWorldIntegrity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorldIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                world_hash, integrity_data, verified_at, created_at, updated_at
         FROM atc_world_integrity
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

  async findByIntegrityId(integrityId: string): Promise<AtcWorldIntegrity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorldIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                world_hash, integrity_data, verified_at, created_at, updated_at
         FROM atc_world_integrity
         WHERE integrity_id = ?
         LIMIT 1`,
        [integrityId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcIntegrityStatus,
    verifiedAt?: Date | undefined,
    worldHash?: string | undefined
  ): Promise<AtcWorldIntegrity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<WorldIntegrityRow[]>(
          `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                  world_hash, integrity_data, verified_at, created_at, updated_at
           FROM atc_world_integrity
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new IntegrityNotFoundError(id)

        if (verifiedAt !== undefined && worldHash !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_world_integrity
             SET status = ?, verified_at = ?, world_hash = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              verifiedAt.toISOString().replace('T', ' ').replace('Z', ''),
              worldHash,
              id,
            ] as (string | number | boolean | null)[]
          )
        } else if (verifiedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_world_integrity
             SET status = ?, verified_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              verifiedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else if (worldHash !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_world_integrity
             SET status = ?, world_hash = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, worldHash, id] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_world_integrity
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<WorldIntegrityRow[]>(
          `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                  world_hash, integrity_data, verified_at, created_at, updated_at
           FROM atc_world_integrity
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new IntegrityNotFoundError(id)

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
        `DELETE FROM atc_world_integrity
         WHERE status IN ('verified', 'failed', 'corrupted')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
