import type { RowDataPacket } from 'mysql2/promise'
import type { PoolConnection, CombatSimulationPool } from './pool.js'
import { generateId } from './id.js'
import { BallisticsNotFoundError } from './errors.js'

interface BallisticsRuntimeRow extends RowDataPacket {
  id: string
  session_id: string
  entity_id: string
  ballistic_type: string
  trajectory_data: string
  impact_data: string
  velocity: number
  penetration_depth: number
  owner_server_id: string
  is_resolved: number
  created_at: Date
  updated_at: Date
}

export type AtcBallisticType = 'bullet' | 'explosive' | 'melee' | 'energy' | 'custom'

export interface AtcBallisticRecord {
  id: string
  sessionId: string
  entityId: string
  ballisticType: AtcBallisticType
  trajectoryData: Record<string, unknown>
  impactData: Record<string, unknown>
  velocity: number
  penetrationDepth: number
  ownerServerId: string
  isResolved: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateBallisticParams {
  sessionId: string
  entityId: string
  ballisticType: AtcBallisticType
  trajectoryData?: Record<string, unknown>
  impactData?: Record<string, unknown>
  velocity: number
  penetrationDepth: number
  ownerServerId: string
}

function mapRow(row: BallisticsRuntimeRow): AtcBallisticRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    entityId: row.entity_id,
    ballisticType: row.ballistic_type as AtcBallisticType,
    trajectoryData: JSON.parse(row.trajectory_data) as Record<string, unknown>,
    impactData: JSON.parse(row.impact_data) as Record<string, unknown>,
    velocity: row.velocity,
    penetrationDepth: row.penetration_depth,
    ownerServerId: row.owner_server_id,
    isResolved: row.is_resolved === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class BallisticsRuntimeRepository {
  constructor(private pool: CombatSimulationPool) {}

  async create(params: CreateBallisticParams): Promise<AtcBallisticRecord> {
    const id = generateId()
    const trajectoryData = JSON.stringify(params.trajectoryData ?? {})
    const impactData = JSON.stringify(params.impactData ?? {})
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        await conn.execute(
          `INSERT INTO atc_ballistics_runtime
            (id, session_id, entity_id, ballistic_type, trajectory_data, impact_data, velocity, penetration_depth, owner_server_id, is_resolved, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(3), NOW(3))`,
          [
            id,
            params.sessionId,
            params.entityId,
            params.ballisticType,
            trajectoryData,
            impactData,
            params.velocity,
            params.penetrationDepth,
            params.ownerServerId,
          ]
        )
        await conn.commit()
        const [rows] = await conn.execute<BallisticsRuntimeRow[]>(
          'SELECT * FROM atc_ballistics_runtime WHERE id = ?',
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

  async findById(id: string): Promise<AtcBallisticRecord | null> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<BallisticsRuntimeRow[]>(
        'SELECT * FROM atc_ballistics_runtime WHERE id = ?',
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async markResolved(id: string): Promise<AtcBallisticRecord> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        const [rows] = await conn.execute<BallisticsRuntimeRow[]>(
          'SELECT * FROM atc_ballistics_runtime WHERE id = ? FOR UPDATE',
          [id]
        )
        if (!rows[0]) throw new BallisticsNotFoundError(id)
        await conn.execute(
          'UPDATE atc_ballistics_runtime SET is_resolved = 1, updated_at = NOW(3) WHERE id = ?',
          [id]
        )
        await conn.commit()
        const [updated] = await conn.execute<BallisticsRuntimeRow[]>(
          'SELECT * FROM atc_ballistics_runtime WHERE id = ?',
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

  async listUnresolvedBySession(sessionId: string): Promise<AtcBallisticRecord[]> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<BallisticsRuntimeRow[]>(
        'SELECT * FROM atc_ballistics_runtime WHERE session_id = ? AND is_resolved = 0',
        [sessionId]
      )
      return rows.map(mapRow)
    } finally {
      conn?.release()
    }
  }
}
