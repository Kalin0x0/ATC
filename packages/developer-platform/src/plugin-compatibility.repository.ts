import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DeveloperPlatformPool } from './pool.js'
import { generateId } from './id.js'
import { PluginCompatibilityNotFoundError, DuplicatePluginCompatibilityError } from './errors.js'

export type AtcCompatibilityType = 'forward' | 'backward' | 'full' | 'partial' | 'custom'
export type AtcCompatibilityStatus = 'pending' | 'validating' | 'compatible' | 'incompatible' | 'failed'

export interface AtcPluginCompatibility {
  id: string
  compatibilityId: string
  compatibilityType: AtcCompatibilityType
  status: AtcCompatibilityStatus
  ownerServerId: string
  compatibilityNonce: string
  compatibilityData: Record<string, unknown>
  validatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCompatibilityParams {
  compatibilityType: AtcCompatibilityType
  ownerServerId: string
  compatibilityNonce: string
  compatibilityData?: Record<string, unknown> | undefined
}

interface PluginCompatibilityRow extends RowDataPacket {
  id: string
  compatibility_id: string
  compatibility_type: string
  status: string
  owner_server_id: string
  compatibility_nonce: string
  compatibility_data: string | null
  validated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: PluginCompatibilityRow): AtcPluginCompatibility {
  let compatibilityData: Record<string, unknown> = {}
  if (row.compatibility_data) {
    try {
      compatibilityData = JSON.parse(row.compatibility_data) as Record<string, unknown>
    } catch {
      compatibilityData = {}
    }
  }
  return {
    id: row.id,
    compatibilityId: row.compatibility_id,
    compatibilityType: row.compatibility_type as AtcCompatibilityType,
    status: row.status as AtcCompatibilityStatus,
    ownerServerId: row.owner_server_id,
    compatibilityNonce: row.compatibility_nonce,
    compatibilityData,
    validatedAt: row.validated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class PluginCompatibilityRepository {
  constructor(private readonly pool: DeveloperPlatformPool) {}

  async create(params: CreateCompatibilityParams): Promise<AtcPluginCompatibility> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const compatibilityId = generateId()
      const compatibilityDataJson = JSON.stringify(params.compatibilityData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_plugin_compatibility
             (id, compatibility_id, compatibility_type, status, owner_server_id,
              compatibility_nonce, compatibility_data, validated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            compatibilityId,
            params.compatibilityType,
            params.ownerServerId,
            params.compatibilityNonce,
            compatibilityDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicatePluginCompatibilityError(params.compatibilityNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<PluginCompatibilityRow[]>(
        `SELECT id, compatibility_id, compatibility_type, status, owner_server_id,
                compatibility_nonce, compatibility_data, validated_at, created_at, updated_at
         FROM atc_plugin_compatibility
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Plugin compatibility not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcPluginCompatibility | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PluginCompatibilityRow[]>(
        `SELECT id, compatibility_id, compatibility_type, status, owner_server_id,
                compatibility_nonce, compatibility_data, validated_at, created_at, updated_at
         FROM atc_plugin_compatibility
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
    status: AtcCompatibilityStatus,
    validatedAt?: Date | undefined
  ): Promise<AtcPluginCompatibility> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<PluginCompatibilityRow[]>(
          `SELECT id, compatibility_id, compatibility_type, status, owner_server_id,
                  compatibility_nonce, compatibility_data, validated_at, created_at, updated_at
           FROM atc_plugin_compatibility
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new PluginCompatibilityNotFoundError(id)

        if (validatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_plugin_compatibility
             SET status = ?, validated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, validatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_plugin_compatibility
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<PluginCompatibilityRow[]>(
          `SELECT id, compatibility_id, compatibility_type, status, owner_server_id,
                  compatibility_nonce, compatibility_data, validated_at, created_at, updated_at
           FROM atc_plugin_compatibility
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new PluginCompatibilityNotFoundError(id)

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
        `DELETE FROM atc_plugin_compatibility
         WHERE status IN ('incompatible', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
