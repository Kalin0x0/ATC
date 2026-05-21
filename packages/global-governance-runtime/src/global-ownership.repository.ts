import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GlobalGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { OwnershipNotFoundError } from './errors.js'

export type AtcOwnershipType = 'exclusive' | 'shared' | 'leased' | 'delegated' | 'custom'
export type AtcOwnershipStatus = 'claimed' | 'transferred' | 'released' | 'contested'

export interface AtcGlobalOwnership {
  id: string
  resourceId: string
  ownershipType: AtcOwnershipType
  status: AtcOwnershipStatus
  ownerServerId: string
  ownershipData: Record<string, unknown>
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertOwnershipParams {
  resourceId: string
  ownershipType: AtcOwnershipType
  ownerServerId: string
  ownershipData?: Record<string, unknown> | undefined
}

interface GlobalOwnershipRow extends RowDataPacket {
  id: string
  resource_id: string
  ownership_type: string
  status: string
  owner_server_id: string
  ownership_data: string | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: GlobalOwnershipRow): AtcGlobalOwnership {
  let ownershipData: Record<string, unknown> = {}
  if (row.ownership_data) {
    try {
      ownershipData = JSON.parse(row.ownership_data) as Record<string, unknown>
    } catch {
      ownershipData = {}
    }
  }
  return {
    id: row.id,
    resourceId: row.resource_id,
    ownershipType: row.ownership_type as AtcOwnershipType,
    status: row.status as AtcOwnershipStatus,
    ownerServerId: row.owner_server_id,
    ownershipData,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class GlobalOwnershipRepository {
  constructor(private readonly pool: GlobalGovernancePool) {}

  async upsert(params: UpsertOwnershipParams): Promise<AtcGlobalOwnership> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const ownershipDataJson = JSON.stringify(params.ownershipData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_global_ownership
           (id, resource_id, ownership_type, status, owner_server_id,
            ownership_data, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, 'claimed', ?, ?, NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           ownership_type = VALUES(ownership_type),
           status = 'claimed',
           owner_server_id = VALUES(owner_server_id),
           ownership_data = VALUES(ownership_data),
           updated_at = NOW(3)`,
        [
          id,
          params.resourceId,
          params.ownershipType,
          params.ownerServerId,
          ownershipDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<GlobalOwnershipRow[]>(
        `SELECT id, resource_id, ownership_type, status, owner_server_id,
                ownership_data, expires_at, created_at, updated_at
         FROM atc_global_ownership
         WHERE resource_id = ?
         LIMIT 1`,
        [params.resourceId]
      )
      if (!rows[0]) throw new Error(`Global ownership record not found after upsert: ${params.resourceId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByResourceId(resourceId: string): Promise<AtcGlobalOwnership | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GlobalOwnershipRow[]>(
        `SELECT id, resource_id, ownership_type, status, owner_server_id,
                ownership_data, expires_at, created_at, updated_at
         FROM atc_global_ownership
         WHERE resource_id = ?
         LIMIT 1`,
        [resourceId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async transfer(resourceId: string, newOwnerServerId: string): Promise<AtcGlobalOwnership> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<GlobalOwnershipRow[]>(
          `SELECT id, resource_id, ownership_type, status, owner_server_id,
                  ownership_data, expires_at, created_at, updated_at
           FROM atc_global_ownership
           WHERE resource_id = ?
           LIMIT 1
           FOR UPDATE`,
          [resourceId]
        )
        if (!lockRows[0]) throw new OwnershipNotFoundError(resourceId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_global_ownership
           SET owner_server_id = ?, status = 'transferred', updated_at = NOW(3)
           WHERE resource_id = ?`,
          [newOwnerServerId, resourceId] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<GlobalOwnershipRow[]>(
          `SELECT id, resource_id, ownership_type, status, owner_server_id,
                  ownership_data, expires_at, created_at, updated_at
           FROM atc_global_ownership
           WHERE resource_id = ?
           LIMIT 1`,
          [resourceId]
        )
        if (!rows[0]) throw new OwnershipNotFoundError(resourceId)

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

  async release(resourceId: string): Promise<AtcGlobalOwnership> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<GlobalOwnershipRow[]>(
          `SELECT id, resource_id, ownership_type, status, owner_server_id,
                  ownership_data, expires_at, created_at, updated_at
           FROM atc_global_ownership
           WHERE resource_id = ?
           LIMIT 1
           FOR UPDATE`,
          [resourceId]
        )
        if (!lockRows[0]) throw new OwnershipNotFoundError(resourceId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_global_ownership
           SET status = 'released', updated_at = NOW(3)
           WHERE resource_id = ?`,
          [resourceId] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<GlobalOwnershipRow[]>(
          `SELECT id, resource_id, ownership_type, status, owner_server_id,
                  ownership_data, expires_at, created_at, updated_at
           FROM atc_global_ownership
           WHERE resource_id = ?
           LIMIT 1`,
          [resourceId]
        )
        if (!rows[0]) throw new OwnershipNotFoundError(resourceId)

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
        `DELETE FROM atc_global_ownership
         WHERE status IN ('released', 'contested')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
