import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeLockdownPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateLockdownError, ProductionIntegrityNotFoundError } from './errors.js'

export type AtcProductionIntegrityType = 'pre_deployment' | 'post_deployment' | 'runtime' | 'rollback' | 'custom'
export type AtcProductionIntegrityStatus = 'pending' | 'running' | 'passed' | 'failed'

export interface AtcProductionIntegrity {
  id: string
  integrityId: string
  integrityType: AtcProductionIntegrityType
  status: AtcProductionIntegrityStatus
  ownerServerId: string
  integrityNonce: string
  integrityData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductionIntegrityParams {
  integrityType: AtcProductionIntegrityType
  ownerServerId: string
  integrityNonce: string
  integrityData?: Record<string, unknown> | undefined
}

interface ProductionIntegrityRow extends RowDataPacket {
  id: string
  integrity_id: string
  integrity_type: string
  status: string
  owner_server_id: string
  integrity_nonce: string
  integrity_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProductionIntegrityRow): AtcProductionIntegrity {
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
    integrityType: row.integrity_type as AtcProductionIntegrityType,
    status: row.status as AtcProductionIntegrityStatus,
    ownerServerId: row.owner_server_id,
    integrityNonce: row.integrity_nonce,
    integrityData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProductionIntegrityRepository {
  constructor(private readonly pool: RuntimeLockdownPool) {}

  async create(params: CreateProductionIntegrityParams): Promise<AtcProductionIntegrity> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const integrityId = generateId()
      const integrityDataJson = JSON.stringify(params.integrityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_production_integrity
             (id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
              integrity_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
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
          throw new DuplicateLockdownError(params.integrityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ProductionIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                integrity_data, completed_at, created_at, updated_at
         FROM atc_production_integrity
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Production integrity record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcProductionIntegrity | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionIntegrityRow[]>(
        `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                integrity_data, completed_at, created_at, updated_at
         FROM atc_production_integrity
         WHERE id = ?
         LIMIT 1`,
        [id]
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
    status: AtcProductionIntegrityStatus,
    completedAt?: Date | undefined
  ): Promise<AtcProductionIntegrity> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProductionIntegrityRow[]>(
          `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                  integrity_data, completed_at, created_at, updated_at
           FROM atc_production_integrity
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new ProductionIntegrityNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_integrity
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
            `UPDATE atc_production_integrity
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<ProductionIntegrityRow[]>(
          `SELECT id, integrity_id, integrity_type, status, owner_server_id, integrity_nonce,
                  integrity_data, completed_at, created_at, updated_at
           FROM atc_production_integrity
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        const row = rows[0]
        if (!row) throw new ProductionIntegrityNotFoundError(id)

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
        `DELETE FROM atc_production_integrity
         WHERE status IN ('passed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
