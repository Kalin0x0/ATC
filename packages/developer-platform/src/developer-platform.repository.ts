import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DeveloperPlatformPool } from './pool.js'
import { generateId } from './id.js'
import { DeveloperPlatformNotFoundError, DuplicateDeveloperPlatformError } from './errors.js'

export type AtcDeveloperPlatformType = 'sdk' | 'plugin' | 'extension' | 'contract' | 'custom'
export type AtcDeveloperPlatformStatus = 'pending' | 'active' | 'deprecated' | 'archived' | 'failed'

export interface AtcDeveloperPlatform {
  id: string
  platformId: string
  platformType: AtcDeveloperPlatformType
  status: AtcDeveloperPlatformStatus
  ownerServerId: string
  platformNonce: string
  platformData: Record<string, unknown>
  activatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDeveloperPlatformParams {
  platformType: AtcDeveloperPlatformType
  ownerServerId: string
  platformNonce: string
  platformData?: Record<string, unknown> | undefined
}

interface DeveloperPlatformRow extends RowDataPacket {
  id: string
  platform_id: string
  platform_type: string
  status: string
  owner_server_id: string
  platform_nonce: string
  platform_data: string | null
  activated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DeveloperPlatformRow): AtcDeveloperPlatform {
  let platformData: Record<string, unknown> = {}
  if (row.platform_data) {
    try {
      platformData = JSON.parse(row.platform_data) as Record<string, unknown>
    } catch {
      platformData = {}
    }
  }
  return {
    id: row.id,
    platformId: row.platform_id,
    platformType: row.platform_type as AtcDeveloperPlatformType,
    status: row.status as AtcDeveloperPlatformStatus,
    ownerServerId: row.owner_server_id,
    platformNonce: row.platform_nonce,
    platformData,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DeveloperPlatformRepository {
  constructor(private readonly pool: DeveloperPlatformPool) {}

  async create(params: CreateDeveloperPlatformParams): Promise<AtcDeveloperPlatform> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const platformId = generateId()
      const platformDataJson = JSON.stringify(params.platformData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_developer_platform
             (id, platform_id, platform_type, status, owner_server_id,
              platform_nonce, platform_data, activated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            platformId,
            params.platformType,
            params.ownerServerId,
            params.platformNonce,
            platformDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateDeveloperPlatformError(params.platformNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<DeveloperPlatformRow[]>(
        `SELECT id, platform_id, platform_type, status, owner_server_id,
                platform_nonce, platform_data, activated_at, created_at, updated_at
         FROM atc_developer_platform
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Developer platform not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDeveloperPlatform | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DeveloperPlatformRow[]>(
        `SELECT id, platform_id, platform_type, status, owner_server_id,
                platform_nonce, platform_data, activated_at, created_at, updated_at
         FROM atc_developer_platform
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
    status: AtcDeveloperPlatformStatus,
    activatedAt?: Date | undefined
  ): Promise<AtcDeveloperPlatform> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DeveloperPlatformRow[]>(
          `SELECT id, platform_id, platform_type, status, owner_server_id,
                  platform_nonce, platform_data, activated_at, created_at, updated_at
           FROM atc_developer_platform
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new DeveloperPlatformNotFoundError(id)

        if (activatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_developer_platform
             SET status = ?, activated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, activatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_developer_platform
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<DeveloperPlatformRow[]>(
          `SELECT id, platform_id, platform_type, status, owner_server_id,
                  platform_nonce, platform_data, activated_at, created_at, updated_at
           FROM atc_developer_platform
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new DeveloperPlatformNotFoundError(id)

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
        `DELETE FROM atc_developer_platform
         WHERE status IN ('deprecated', 'archived', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
