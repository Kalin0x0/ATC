import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreFinalizationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateProductionSealError, ProductionSealNotFoundError } from './errors.js'

export type AtcProductionSealType = 'permanent' | 'temporary' | 'conditional' | 'emergency' | 'custom'
export type AtcProductionSealStatus = 'pending' | 'applied' | 'locked' | 'broken' | 'expired'

export interface AtcProductionSeal {
  id: string
  sealId: string
  sealType: AtcProductionSealType
  status: AtcProductionSealStatus
  ownerServerId: string
  resourceId: string
  sealNonce: string
  sealData: Record<string, unknown>
  lockedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateProductionSealParams {
  sealType: AtcProductionSealType
  ownerServerId: string
  resourceId: string
  sealNonce: string
  sealData?: Record<string, unknown> | undefined
}

interface ProductionSealRow extends RowDataPacket {
  id: string
  seal_id: string
  seal_type: string
  status: string
  owner_server_id: string
  resource_id: string
  seal_nonce: string
  seal_data: string | null
  locked_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProductionSealRow): AtcProductionSeal {
  let sealData: Record<string, unknown> = {}
  if (row.seal_data) {
    try {
      sealData = JSON.parse(row.seal_data) as Record<string, unknown>
    } catch {
      sealData = {}
    }
  }
  return {
    id: row.id,
    sealId: row.seal_id,
    sealType: row.seal_type as AtcProductionSealType,
    status: row.status as AtcProductionSealStatus,
    ownerServerId: row.owner_server_id,
    resourceId: row.resource_id,
    sealNonce: row.seal_nonce,
    sealData,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProductionSealRepository {
  constructor(private readonly pool: CoreFinalizationPool) {}

  async create(params: CreateProductionSealParams): Promise<AtcProductionSeal> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sealId = generateId()
      const sealDataJson = JSON.stringify(params.sealData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_production_seals
             (id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
              seal_data, locked_at, created_at, updated_at)
           VALUES (?, ?, ?, 'applied', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            sealId,
            params.sealType,
            params.ownerServerId,
            params.resourceId,
            params.sealNonce,
            sealDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateProductionSealError(params.sealNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ProductionSealRow[]>(
        `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                seal_data, locked_at, created_at, updated_at
         FROM atc_production_seals
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Production seal record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcProductionSeal | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionSealRow[]>(
        `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                seal_data, locked_at, created_at, updated_at
         FROM atc_production_seals
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
    status: AtcProductionSealStatus,
    lockedAt?: Date | undefined
  ): Promise<AtcProductionSeal> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProductionSealRow[]>(
          `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                  seal_data, locked_at, created_at, updated_at
           FROM atc_production_seals
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ProductionSealNotFoundError(id)

        if (lockedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_seals
             SET status = ?, locked_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              lockedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_seals
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<ProductionSealRow[]>(
          `SELECT id, seal_id, seal_type, status, owner_server_id, resource_id, seal_nonce,
                  seal_data, locked_at, created_at, updated_at
           FROM atc_production_seals
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ProductionSealNotFoundError(id)

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
        `DELETE FROM atc_production_seals
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
