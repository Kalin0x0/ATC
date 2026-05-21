import type { RowDataPacket } from 'mysql2/promise'
import type { PoolConnection, CombatSimulationPool } from './pool.js'
import { generateId } from './id.js'
import { TacticalDamageNotFoundError } from './errors.js'

interface TacticalDamageRow extends RowDataPacket {
  id: string
  session_id: string
  entity_id: string
  attacker_id: string | null
  damage_type: string
  damage_amount: number
  armor_penetration: number
  body_zone: string
  is_processed: number
  damage_data: string
  owner_server_id: string
  processed_at: Date | null
  created_at: Date
  updated_at: Date
}

export type AtcDamageType = 'ballistic' | 'explosive' | 'melee' | 'fire' | 'toxic' | 'custom'

export interface AtcTacticalDamage {
  id: string
  sessionId: string
  entityId: string
  attackerId: string | null
  damageType: AtcDamageType
  damageAmount: number
  armorPenetration: number
  bodyZone: string
  isProcessed: boolean
  damageData: Record<string, unknown>
  ownerServerId: string
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDamageParams {
  sessionId: string
  entityId: string
  attackerId?: string
  damageType: AtcDamageType
  damageAmount: number
  armorPenetration?: number
  bodyZone?: string
  damageData?: Record<string, unknown>
  ownerServerId: string
}

function mapRow(row: TacticalDamageRow): AtcTacticalDamage {
  return {
    id: row.id,
    sessionId: row.session_id,
    entityId: row.entity_id,
    attackerId: row.attacker_id,
    damageType: row.damage_type as AtcDamageType,
    damageAmount: row.damage_amount,
    armorPenetration: row.armor_penetration,
    bodyZone: row.body_zone,
    isProcessed: row.is_processed === 1,
    damageData: JSON.parse(row.damage_data) as Record<string, unknown>,
    ownerServerId: row.owner_server_id,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class TacticalDamageRepository {
  constructor(private pool: CombatSimulationPool) {}

  async create(params: CreateDamageParams): Promise<AtcTacticalDamage> {
    const id = generateId()
    const damageData = JSON.stringify(params.damageData ?? {})
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        await conn.execute(
          `INSERT INTO atc_tactical_damage
            (id, session_id, entity_id, attacker_id, damage_type, damage_amount, armor_penetration, body_zone, is_processed, damage_data, owner_server_id, processed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            params.sessionId,
            params.entityId,
            params.attackerId ?? null,
            params.damageType,
            params.damageAmount,
            params.armorPenetration ?? 0,
            params.bodyZone ?? 'torso',
            damageData,
            params.ownerServerId,
          ]
        )
        await conn.commit()
        const [rows] = await conn.execute<TacticalDamageRow[]>(
          'SELECT * FROM atc_tactical_damage WHERE id = ?',
          [id]
        )
        if (!rows[0]) throw new Error('Insert failed')
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn?.release()
    }
  }

  async findById(id: string): Promise<AtcTacticalDamage | null> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<TacticalDamageRow[]>(
        'SELECT * FROM atc_tactical_damage WHERE id = ?',
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async markProcessed(id: string): Promise<AtcTacticalDamage> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        const [rows] = await conn.execute<TacticalDamageRow[]>(
          'SELECT * FROM atc_tactical_damage WHERE id = ? FOR UPDATE',
          [id]
        )
        if (!rows[0]) throw new TacticalDamageNotFoundError(id)
        await conn.execute(
          'UPDATE atc_tactical_damage SET is_processed = 1, processed_at = NOW(3), updated_at = NOW(3) WHERE id = ?',
          [id]
        )
        await conn.commit()
        const [updated] = await conn.execute<TacticalDamageRow[]>(
          'SELECT * FROM atc_tactical_damage WHERE id = ?',
          [id]
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

  async listUnprocessedBySession(sessionId: string): Promise<AtcTacticalDamage[]> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<TacticalDamageRow[]>(
        'SELECT * FROM atc_tactical_damage WHERE session_id = ? AND is_processed = 0',
        [sessionId]
      )
      return rows.map(mapRow)
    } finally {
      conn?.release()
    }
  }
}
