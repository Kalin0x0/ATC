import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EcologyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateRegenerationError, RegenerationNotFoundError } from './errors.js'

export type AtcResourceRegenerationType =
  | 'flora'
  | 'fauna'
  | 'mineral'
  | 'water'
  | 'soil'
  | 'custom'

export type AtcRegenerationStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcResourceRegeneration {
  id: string
  regenerationId: string
  resourceType: AtcResourceRegenerationType
  status: AtcRegenerationStatus
  ownerServerId: string
  regionId: string | null
  regenerationNonce: string
  regenerationData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ResourceRegenerationRow extends RowDataPacket {
  id: string
  regeneration_id: string
  resource_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  regeneration_nonce: string
  regeneration_data: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ResourceRegenerationRow): AtcResourceRegeneration {
  let regenerationData: Record<string, unknown> = {}
  try {
    const parsed: unknown = typeof row.regeneration_data === 'string'
      ? JSON.parse(row.regeneration_data)
      : row.regeneration_data
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      regenerationData = parsed as Record<string, unknown>
    }
  } catch {
    regenerationData = {}
  }
  return {
    id: row.id,
    regenerationId: row.regeneration_id,
    resourceType: row.resource_type as AtcResourceRegenerationType,
    status: row.status as AtcRegenerationStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    regenerationNonce: row.regeneration_nonce,
    regenerationData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateRegenerationParams {
  regenerationId: string
  resourceType: AtcResourceRegenerationType
  status: AtcRegenerationStatus
  ownerServerId: string
  regionId?: string | null
  regenerationNonce: string
  regenerationData?: Record<string, unknown>
}

export class ResourceRegenerationRepository {
  constructor(private readonly pool: EcologyRuntimePool) {}

  async create(params: CreateRegenerationParams): Promise<AtcResourceRegeneration> {
    const id = generateId()
    const regenerationData = JSON.stringify(params.regenerationData ?? {})
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_resource_regeneration
             (id, regeneration_id, resource_type, status, owner_server_id, region_id,
              regeneration_nonce, regeneration_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            params.regenerationId,
            params.resourceType,
            params.status,
            params.ownerServerId,
            params.regionId ?? null,
            params.regenerationNonce,
            regenerationData,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateRegenerationError(params.regenerationId)
        }
        throw err
      }
      const [rows] = await conn.execute<ResourceRegenerationRow[]>(
        `SELECT * FROM atc_resource_regeneration WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new RegenerationNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcResourceRegeneration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResourceRegenerationRow[]>(
        `SELECT * FROM atc_resource_regeneration WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      return row ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcRegenerationStatus,
    completedAt?: Date,
  ): Promise<AtcResourceRegeneration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ResourceRegenerationRow[]>(
          `SELECT * FROM atc_resource_regeneration WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          await conn.rollback()
          throw new RegenerationNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_resource_regeneration
           SET status = ?, completed_at = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, completedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<ResourceRegenerationRow[]>(
        `SELECT * FROM atc_resource_regeneration WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new RegenerationNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_resource_regeneration
         WHERE status IN ('failed','completed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
