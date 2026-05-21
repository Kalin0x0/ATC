import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DeveloperPlatformPool } from './pool.js'
import { generateId } from './id.js'
import { SdkRegistryNotFoundError } from './errors.js'

export type AtcSdkType = 'core' | 'plugin' | 'runtime' | 'integration' | 'custom'
export type AtcSdkStatus = 'active' | 'deprecated' | 'retired' | 'failed'

export interface AtcSdkRegistry {
  id: string
  sdkId: string
  sdkType: AtcSdkType
  status: AtcSdkStatus
  ownerServerId: string
  sdkData: Record<string, unknown>
  registeredAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface RegisterSdkParams {
  sdkId: string
  sdkType: AtcSdkType
  ownerServerId: string
  sdkData?: Record<string, unknown> | undefined
}

interface SdkRegistryRow extends RowDataPacket {
  id: string
  sdk_id: string
  sdk_type: string
  status: string
  owner_server_id: string
  sdk_data: string | null
  registered_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: SdkRegistryRow): AtcSdkRegistry {
  let sdkData: Record<string, unknown> = {}
  if (row.sdk_data) {
    try {
      sdkData = JSON.parse(row.sdk_data) as Record<string, unknown>
    } catch {
      sdkData = {}
    }
  }
  return {
    id: row.id,
    sdkId: row.sdk_id,
    sdkType: row.sdk_type as AtcSdkType,
    status: row.status as AtcSdkStatus,
    ownerServerId: row.owner_server_id,
    sdkData,
    registeredAt: row.registered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SdkRegistryRepository {
  constructor(private readonly pool: DeveloperPlatformPool) {}

  async upsert(params: RegisterSdkParams): Promise<AtcSdkRegistry> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sdkDataJson = JSON.stringify(params.sdkData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_sdk_registry
           (id, sdk_id, sdk_type, status, owner_server_id,
            sdk_data, registered_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           sdk_type = VALUES(sdk_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           sdk_data = VALUES(sdk_data),
           registered_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.sdkId,
          params.sdkType,
          params.ownerServerId,
          sdkDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<SdkRegistryRow[]>(
        `SELECT id, sdk_id, sdk_type, status, owner_server_id,
                sdk_data, registered_at, created_at, updated_at
         FROM atc_sdk_registry
         WHERE sdk_id = ?
         LIMIT 1`,
        [params.sdkId] as unknown[]
      )
      if (!rows[0]) throw new Error(`SDK registry not found after upsert: ${params.sdkId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findBySdkId(sdkId: string): Promise<AtcSdkRegistry | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SdkRegistryRow[]>(
        `SELECT id, sdk_id, sdk_type, status, owner_server_id,
                sdk_data, registered_at, created_at, updated_at
         FROM atc_sdk_registry
         WHERE sdk_id = ?
         LIMIT 1`,
        [sdkId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(sdkId: string, status: AtcSdkStatus): Promise<AtcSdkRegistry> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<SdkRegistryRow[]>(
          `SELECT id, sdk_id, sdk_type, status, owner_server_id,
                  sdk_data, registered_at, created_at, updated_at
           FROM atc_sdk_registry
           WHERE sdk_id = ?
           LIMIT 1
           FOR UPDATE`,
          [sdkId] as unknown[]
        )
        if (!lockRows[0]) throw new SdkRegistryNotFoundError(sdkId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_sdk_registry
           SET status = ?, updated_at = NOW(3)
           WHERE sdk_id = ?`,
          [status, sdkId] as unknown[]
        )

        const [rows] = await conn.execute<SdkRegistryRow[]>(
          `SELECT id, sdk_id, sdk_type, status, owner_server_id,
                  sdk_data, registered_at, created_at, updated_at
           FROM atc_sdk_registry
           WHERE sdk_id = ?
           LIMIT 1`,
          [sdkId] as unknown[]
        )
        if (!rows[0]) throw new SdkRegistryNotFoundError(sdkId)

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
        `DELETE FROM atc_sdk_registry
         WHERE status IN ('retired', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
