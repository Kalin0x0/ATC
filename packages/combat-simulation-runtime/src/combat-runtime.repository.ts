import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { PoolConnection, CombatSimulationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateCombatSessionError, CombatSessionNotFoundError } from './errors.js'

interface CombatRuntimeRow extends RowDataPacket {
  id: string
  session_id: string
  entity_id: string
  target_id: string
  combat_type: string
  status: string
  owner_server_id: string
  region_id: string
  session_nonce: string
  combat_data: string
  started_at: Date
  ended_at: Date | null
  created_at: Date
  updated_at: Date
}

export type AtcCombatType = 'pvp' | 'pve' | 'faction' | 'siege' | 'skirmish' | 'custom'
export type AtcCombatStatus = 'active' | 'paused' | 'ended' | 'abandoned'

export interface AtcCombatSession {
  id: string
  sessionId: string
  entityId: string
  targetId: string
  combatType: AtcCombatType
  status: AtcCombatStatus
  ownerServerId: string
  regionId: string
  sessionNonce: string
  combatData: Record<string, unknown>
  startedAt: Date
  endedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCombatSessionParams {
  sessionId: string
  entityId: string
  targetId: string
  combatType: AtcCombatType
  status: AtcCombatStatus
  ownerServerId: string
  regionId: string
  sessionNonce: string
  combatData?: Record<string, unknown>
  startedAt: Date
}

function mapRow(row: CombatRuntimeRow): AtcCombatSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    entityId: row.entity_id,
    targetId: row.target_id,
    combatType: row.combat_type as AtcCombatType,
    status: row.status as AtcCombatStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    sessionNonce: row.session_nonce,
    combatData: JSON.parse(row.combat_data) as Record<string, unknown>,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CombatRuntimeRepository {
  constructor(private pool: CombatSimulationPool) {}

  async create(params: CreateCombatSessionParams): Promise<AtcCombatSession> {
    const id = generateId()
    const combatData = JSON.stringify(params.combatData ?? {})
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        await conn.execute(
          `INSERT INTO atc_combat_runtime
            (id, session_id, entity_id, target_id, combat_type, status, owner_server_id, region_id, session_nonce, combat_data, started_at, ended_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            params.sessionId,
            params.entityId,
            params.targetId,
            params.combatType,
            params.status,
            params.ownerServerId,
            params.regionId,
            params.sessionNonce,
            combatData,
            params.startedAt.toISOString().replace('T', ' ').replace('Z', ''),
          ]
        )
        await conn.commit()
        const [rows] = await conn.execute<CombatRuntimeRow[]>(
          'SELECT * FROM atc_combat_runtime WHERE id = ?',
          [id]
        )
        if (!rows[0]) throw new Error('Insert failed')
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateCombatSessionError(params.sessionNonce)
        }
        throw err
      }
    } finally {
      conn?.release()
    }
  }

  async findById(id: string): Promise<AtcCombatSession | null> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<CombatRuntimeRow[]>(
        'SELECT * FROM atc_combat_runtime WHERE id = ?',
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async findBySessionId(sessionId: string): Promise<AtcCombatSession | null> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const [rows] = await conn.execute<CombatRuntimeRow[]>(
        'SELECT * FROM atc_combat_runtime WHERE session_id = ?',
        [sessionId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn?.release()
    }
  }

  async updateStatus(id: string, status: AtcCombatStatus, endedAt?: Date): Promise<AtcCombatSession> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      try {
        await conn.beginTransaction()
        const [rows] = await conn.execute<CombatRuntimeRow[]>(
          'SELECT * FROM atc_combat_runtime WHERE id = ? FOR UPDATE',
          [id]
        )
        if (!rows[0]) throw new CombatSessionNotFoundError(id)
        if (endedAt !== undefined) {
          await conn.execute(
            'UPDATE atc_combat_runtime SET status = ?, ended_at = ?, updated_at = NOW(3) WHERE id = ?',
            [status, endedAt.toISOString().replace('T', ' ').replace('Z', ''), id]
          )
        } else {
          await conn.execute(
            'UPDATE atc_combat_runtime SET status = ?, updated_at = NOW(3) WHERE id = ?',
            [status, id]
          )
        }
        await conn.commit()
        const [updated] = await conn.execute<CombatRuntimeRow[]>(
          'SELECT * FROM atc_combat_runtime WHERE id = ?',
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

  async listActive(ownerServerId?: string): Promise<AtcCombatSession[]> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      let rows: CombatRuntimeRow[]
      if (ownerServerId !== undefined) {
        const [result] = await conn.execute<CombatRuntimeRow[]>(
          "SELECT * FROM atc_combat_runtime WHERE status = 'active' AND owner_server_id = ?",
          [ownerServerId]
        )
        rows = result
      } else {
        const [result] = await conn.execute<CombatRuntimeRow[]>(
          "SELECT * FROM atc_combat_runtime WHERE status = 'active'"
        )
        rows = result
      }
      return rows.map(mapRow)
    } finally {
      conn?.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    let conn: PoolConnection | null = null
    try {
      conn = await this.pool.getConnection()
      const thresholdSec = Math.floor(thresholdMs / 1000)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_combat_runtime WHERE updated_at < NOW(3) - INTERVAL ? SECOND`,
        [thresholdSec]
      )
      return result.affectedRows ?? 0
    } finally {
      conn?.release()
    }
  }
}
