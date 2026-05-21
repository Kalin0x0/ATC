import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PoolConnection, CombatSimulationPool } from './pool.js'
import { generateId } from './id.js'
import { SuppressionNotFoundError } from './errors.js'

interface SuppressionRuntimeRow extends RowDataPacket {
  id: string
  entity_id: string
  suppressor_id: string | null
  suppression_type: string
  suppression_level: number
  owner_server_id: string
  region_id: string | null
  is_active: number
  expires_at: Date | null
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

export type AtcSuppressionType = 'gunfire' | 'explosion' | 'smoke' | 'flashbang' | 'psychological' | 'custom'

export interface AtcSuppressionRuntime {
  id: string
  entityId: string
  suppressorId: string | null
  suppressionType: AtcSuppressionType
  suppressionLevel: number
  ownerServerId: string
  regionId: string | null
  isActive: boolean
  expiresAt: Date | null
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertSuppressionParams {
  entityId: string
  suppressorId?: string
  suppressionType: AtcSuppressionType
  suppressionLevel: number
  ownerServerId: string
  regionId?: string
  expiresAt?: Date
}

function mapRow(row: SuppressionRuntimeRow): AtcSuppressionRuntime {
  return {
    id: row.id,
    entityId: row.entity_id,
    suppressorId: row.suppressor_id,
    suppressionType: row.suppression_type as AtcSuppressionType,
    suppressionLevel: row.suppression_level,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    isActive: row.is_active === 1,
    expiresAt: row.expires_at,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class SuppressionRuntimeRepository {
  constructor(private pool: CombatSimulationPool) {}

  async upsert(params: UpsertSuppressionParams): Promise<AtcSuppressionRuntime> {
    const id = generateId()
    const expiresAt = params.expiresAt !== undefined
      ? params.expiresAt.toISOString().replace('T', ' ').replace('Z', '')
      : null
    const suppressorId = params.suppressorId ?? null
    const regionId = params.regionId ?? null
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      await conn.execute(
        `INSERT INTO atc_suppression_runtime
          (id, entity_id, suppressor_id, suppression_type, suppression_level, owner_server_id, region_id, is_active, expires_at, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           suppressor_id = VALUES(suppressor_id),
           suppression_type = VALUES(suppression_type),
           suppression_level = VALUES(suppression_level),
           owner_server_id = VALUES(owner_server_id),
           region_id = VALUES(region_id),
           is_active = 1,
           expires_at = VALUES(expires_at),
           last_tick_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.entityId,
          suppressorId,
          params.suppressionType,
          params.suppressionLevel,
          params.ownerServerId,
          regionId,
          expiresAt,
        ]
      )
      const [rows] = await conn.execute<SuppressionRuntimeRow[]>(
        'SELECT * FROM atc_suppression_runtime WHERE entity_id = ?',
        [params.entityId]
      )
      if (!rows[0]) throw new SuppressionNotFoundError(params.entityId)
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async findByEntityId(entityId: string): Promise<AtcSuppressionRuntime | null> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<SuppressionRuntimeRow[]>(
        'SELECT * FROM atc_suppression_runtime WHERE entity_id = ?',
        [entityId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async deactivate(entityId: string): Promise<void> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      await conn.execute(
        'UPDATE atc_suppression_runtime SET is_active = 0, updated_at = NOW(3) WHERE entity_id = ?',
        [entityId]
      )
    } finally {
      conn?.release()
    }
  }

  async cleanupExpired(): Promise<number> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [result] = await conn.execute<ResultSetHeader>(
        'DELETE FROM atc_suppression_runtime WHERE expires_at < NOW(3) OR is_active = 0'
      )
      return result.affectedRows ?? 0
    } finally {
      conn?.release()
    }
  }
}
