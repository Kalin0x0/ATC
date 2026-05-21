import type { RowDataPacket } from 'mysql2/promise'
import type { PoolConnection, CombatSimulationPool } from './pool.js'
import { generateId } from './id.js'
import { ArmorRuntimeNotFoundError } from './errors.js'

interface ArmorRuntimeRow extends RowDataPacket {
  id: string
  entity_id: string
  armor_type: string
  protection_level: number
  penetration_threshold: number
  current_integrity: number
  owner_server_id: string
  is_active: number
  armor_data: string
  created_at: Date
  updated_at: Date
}

export type AtcArmorType = 'none' | 'light' | 'medium' | 'heavy' | 'ballistic' | 'custom'

export interface AtcArmorRuntime {
  id: string
  entityId: string
  armorType: AtcArmorType
  protectionLevel: number
  penetrationThreshold: number
  currentIntegrity: number
  ownerServerId: string
  isActive: boolean
  armorData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertArmorParams {
  entityId: string
  armorType: AtcArmorType
  protectionLevel: number
  penetrationThreshold?: number
  currentIntegrity?: number
  ownerServerId: string
  armorData?: Record<string, unknown>
}

function mapRow(row: ArmorRuntimeRow): AtcArmorRuntime {
  return {
    id: row.id,
    entityId: row.entity_id,
    armorType: row.armor_type as AtcArmorType,
    protectionLevel: row.protection_level,
    penetrationThreshold: row.penetration_threshold,
    currentIntegrity: row.current_integrity,
    ownerServerId: row.owner_server_id,
    isActive: row.is_active === 1,
    armorData: JSON.parse(row.armor_data) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ArmorRuntimeRepository {
  constructor(private pool: CombatSimulationPool) {}

  async upsert(params: UpsertArmorParams): Promise<AtcArmorRuntime> {
    const id = generateId()
    const armorData = JSON.stringify(params.armorData ?? {})
    const penetrationThreshold = params.penetrationThreshold ?? 0
    const currentIntegrity = params.currentIntegrity ?? 100
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      await conn.execute(
        `INSERT INTO atc_armor_runtime
          (id, entity_id, armor_type, protection_level, penetration_threshold, current_integrity, owner_server_id, is_active, armor_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           armor_type = VALUES(armor_type),
           protection_level = VALUES(protection_level),
           penetration_threshold = VALUES(penetration_threshold),
           current_integrity = VALUES(current_integrity),
           owner_server_id = VALUES(owner_server_id),
           is_active = 1,
           armor_data = VALUES(armor_data),
           updated_at = NOW(3)`,
        [
          id,
          params.entityId,
          params.armorType,
          params.protectionLevel,
          penetrationThreshold,
          currentIntegrity,
          params.ownerServerId,
          armorData,
        ]
      )
      const [rows] = await conn.execute<ArmorRuntimeRow[]>(
        'SELECT * FROM atc_armor_runtime WHERE entity_id = ?',
        [params.entityId]
      )
      if (!rows[0]) throw new ArmorRuntimeNotFoundError(params.entityId)
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async findByEntityId(entityId: string): Promise<AtcArmorRuntime | null> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<ArmorRuntimeRow[]>(
        'SELECT * FROM atc_armor_runtime WHERE entity_id = ?',
        [entityId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async updateIntegrity(entityId: string, integrity: number): Promise<AtcArmorRuntime> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        const [rows] = await conn.execute<ArmorRuntimeRow[]>(
          'SELECT * FROM atc_armor_runtime WHERE entity_id = ? FOR UPDATE',
          [entityId]
        )
        if (!rows[0]) throw new ArmorRuntimeNotFoundError(entityId)
        await conn.execute(
          'UPDATE atc_armor_runtime SET current_integrity = ?, updated_at = NOW(3) WHERE entity_id = ?',
          [integrity, entityId]
        )
        await conn.commit()
        const [updated] = await conn.execute<ArmorRuntimeRow[]>(
          'SELECT * FROM atc_armor_runtime WHERE entity_id = ?',
          [entityId]
        )
        if (!updated[0]) throw new Error('Update failed')
        return mapRow(updated[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn?.release()
    }
  }

  async deactivate(entityId: string): Promise<void> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      await conn.execute(
        'UPDATE atc_armor_runtime SET is_active = 0, updated_at = NOW(3) WHERE entity_id = ?',
        [entityId]
      )
    } finally {
      conn?.release()
    }
  }
}
