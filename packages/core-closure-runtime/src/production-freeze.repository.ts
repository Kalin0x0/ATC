import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CoreClosurePool } from './pool.js'
import { generateId } from './id.js'
import { ProductionFreezeNotFoundError } from './errors.js'

export type AtcFreezeType = 'hard' | 'soft' | 'partial' | 'total' | 'custom'
export type AtcFreezeStatus = 'active' | 'degraded' | 'recovering' | 'failed'

export interface AtcProductionFreeze {
  id: string
  freezeId: string
  freezeType: AtcFreezeType
  status: AtcFreezeStatus
  ownerServerId: string
  freezeData: Record<string, unknown>
  syncedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface InitiateFreezeParams {
  freezeId: string
  freezeType: AtcFreezeType
  ownerServerId: string
  freezeData?: Record<string, unknown> | undefined
}

interface ProductionFreezeRow extends RowDataPacket {
  id: string
  freeze_id: string
  freeze_type: string
  status: string
  owner_server_id: string
  freeze_data: string | null
  synced_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProductionFreezeRow): AtcProductionFreeze {
  let freezeData: Record<string, unknown> = {}
  if (row.freeze_data) {
    try {
      freezeData = JSON.parse(row.freeze_data) as Record<string, unknown>
    } catch {
      freezeData = {}
    }
  }
  return {
    id: row.id,
    freezeId: row.freeze_id,
    freezeType: row.freeze_type as AtcFreezeType,
    status: row.status as AtcFreezeStatus,
    ownerServerId: row.owner_server_id,
    freezeData,
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProductionFreezeRepository {
  constructor(private readonly pool: CoreClosurePool) {}

  async upsert(params: InitiateFreezeParams): Promise<AtcProductionFreeze> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const freezeDataJson = JSON.stringify(params.freezeData ?? {})

      await conn.beginTransaction()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_production_freeze
             (id, freeze_id, freeze_type, status, owner_server_id,
              freeze_data, synced_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
           ON DUPLICATE KEY UPDATE
             freeze_type = VALUES(freeze_type),
             status = VALUES(status),
             owner_server_id = VALUES(owner_server_id),
             freeze_data = VALUES(freeze_data),
             synced_at = NOW(3),
             updated_at = NOW(3)`,
          [
            id,
            params.freezeId,
            params.freezeType,
            params.ownerServerId,
            freezeDataJson,
          ] as unknown[]
        )

        const [rows] = await conn.execute<ProductionFreezeRow[]>(
          `SELECT id, freeze_id, freeze_type, status, owner_server_id,
                  freeze_data, synced_at, created_at, updated_at
           FROM atc_production_freeze
           WHERE freeze_id = ?
           LIMIT 1`,
          [params.freezeId] as unknown[]
        )
        if (!rows[0]) throw new Error(`Production freeze not found after upsert: ${params.freezeId}`)

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

  async findByFreezeId(freezeId: string): Promise<AtcProductionFreeze | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionFreezeRow[]>(
        `SELECT id, freeze_id, freeze_type, status, owner_server_id,
                freeze_data, synced_at, created_at, updated_at
         FROM atc_production_freeze
         WHERE freeze_id = ?
         LIMIT 1`,
        [freezeId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    freezeId: string,
    status: AtcFreezeStatus
  ): Promise<AtcProductionFreeze> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProductionFreezeRow[]>(
          `SELECT id, freeze_id, freeze_type, status, owner_server_id,
                  freeze_data, synced_at, created_at, updated_at
           FROM atc_production_freeze
           WHERE freeze_id = ?
           LIMIT 1
           FOR UPDATE`,
          [freezeId] as unknown[]
        )
        if (!lockRows[0]) throw new ProductionFreezeNotFoundError(freezeId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_production_freeze
           SET status = ?, updated_at = NOW(3)
           WHERE freeze_id = ?`,
          [status, freezeId] as unknown[]
        )

        const [rows] = await conn.execute<ProductionFreezeRow[]>(
          `SELECT id, freeze_id, freeze_type, status, owner_server_id,
                  freeze_data, synced_at, created_at, updated_at
           FROM atc_production_freeze
           WHERE freeze_id = ?
           LIMIT 1`,
          [freezeId] as unknown[]
        )
        if (!rows[0]) throw new ProductionFreezeNotFoundError(freezeId)

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
        `DELETE FROM atc_production_freeze
         WHERE status IN ('failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
