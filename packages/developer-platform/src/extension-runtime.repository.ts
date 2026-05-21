import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DeveloperPlatformPool } from './pool.js'
import { generateId } from './id.js'
import { ExtensionRuntimeNotFoundError, DuplicateExtensionRuntimeError } from './errors.js'

export type AtcExtensionType = 'runtime' | 'sdk' | 'plugin' | 'bridge' | 'custom'
export type AtcExtensionStatus = 'pending' | 'active' | 'suspended' | 'deactivated' | 'failed'

export interface AtcExtensionRuntime {
  id: string
  extensionId: string
  extensionType: AtcExtensionType
  status: AtcExtensionStatus
  ownerServerId: string
  extensionNonce: string
  extensionData: Record<string, unknown>
  activatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateExtensionParams {
  extensionType: AtcExtensionType
  ownerServerId: string
  extensionNonce: string
  extensionData?: Record<string, unknown> | undefined
}

interface ExtensionRuntimeRow extends RowDataPacket {
  id: string
  extension_id: string
  extension_type: string
  status: string
  owner_server_id: string
  extension_nonce: string
  extension_data: string | null
  activated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ExtensionRuntimeRow): AtcExtensionRuntime {
  let extensionData: Record<string, unknown> = {}
  if (row.extension_data) {
    try {
      extensionData = JSON.parse(row.extension_data) as Record<string, unknown>
    } catch {
      extensionData = {}
    }
  }
  return {
    id: row.id,
    extensionId: row.extension_id,
    extensionType: row.extension_type as AtcExtensionType,
    status: row.status as AtcExtensionStatus,
    ownerServerId: row.owner_server_id,
    extensionNonce: row.extension_nonce,
    extensionData,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ExtensionRuntimeRepository {
  constructor(private readonly pool: DeveloperPlatformPool) {}

  async create(params: CreateExtensionParams): Promise<AtcExtensionRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const extensionId = generateId()
      const extensionDataJson = JSON.stringify(params.extensionData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_extension_runtime
             (id, extension_id, extension_type, status, owner_server_id,
              extension_nonce, extension_data, activated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            extensionId,
            params.extensionType,
            params.ownerServerId,
            params.extensionNonce,
            extensionDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateExtensionRuntimeError(params.extensionNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ExtensionRuntimeRow[]>(
        `SELECT id, extension_id, extension_type, status, owner_server_id,
                extension_nonce, extension_data, activated_at, created_at, updated_at
         FROM atc_extension_runtime
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Extension runtime not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcExtensionRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ExtensionRuntimeRow[]>(
        `SELECT id, extension_id, extension_type, status, owner_server_id,
                extension_nonce, extension_data, activated_at, created_at, updated_at
         FROM atc_extension_runtime
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
    status: AtcExtensionStatus,
    activatedAt?: Date | undefined
  ): Promise<AtcExtensionRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ExtensionRuntimeRow[]>(
          `SELECT id, extension_id, extension_type, status, owner_server_id,
                  extension_nonce, extension_data, activated_at, created_at, updated_at
           FROM atc_extension_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new ExtensionRuntimeNotFoundError(id)

        if (activatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_extension_runtime
             SET status = ?, activated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, activatedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_extension_runtime
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<ExtensionRuntimeRow[]>(
          `SELECT id, extension_id, extension_type, status, owner_server_id,
                  extension_nonce, extension_data, activated_at, created_at, updated_at
           FROM atc_extension_runtime
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new ExtensionRuntimeNotFoundError(id)

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
        `DELETE FROM atc_extension_runtime
         WHERE status IN ('suspended', 'deactivated', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
