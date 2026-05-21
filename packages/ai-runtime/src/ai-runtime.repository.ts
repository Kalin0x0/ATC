import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import { AiEntityNotFoundError } from './errors.js'
import type { AiRuntimePool } from './pool.js'

export type AtcAiEntityType = 'npc' | 'vehicle' | 'drone' | 'turret' | 'guard' | 'creature' | 'custom'
export type AtcAiState = 'idle' | 'patrolling' | 'alert' | 'engaged' | 'fleeing' | 'dead' | 'recovering'
export type AtcAiBehaviorMode = 'passive' | 'defensive' | 'aggressive' | 'stealth' | 'support' | 'custom'

export interface AtcAiRuntime {
  id: string
  entityId: string
  entityType: AtcAiEntityType
  aiState: AtcAiState
  behaviorMode: AtcAiBehaviorMode
  ownerServerId: string | null
  positionData: Record<string, unknown>
  threatLevel: number
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface AtcAiRuntimeRow extends RowDataPacket {
  id: string
  entity_id: string
  entity_type: string
  ai_state: string
  behavior_mode: string
  owner_server_id: string | null
  position_data: string
  threat_level: number
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToRuntime(row: AtcAiRuntimeRow): AtcAiRuntime {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityType: row.entity_type as AtcAiEntityType,
    aiState: row.ai_state as AtcAiState,
    behaviorMode: row.behavior_mode as AtcAiBehaviorMode,
    ownerServerId: row.owner_server_id,
    positionData: JSON.parse(row.position_data || '{}') as Record<string, unknown>,
    threatLevel: row.threat_level,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertAiRuntimeParams {
  entityId: string
  entityType: AtcAiEntityType
  aiState?: AtcAiState
  behaviorMode?: AtcAiBehaviorMode
  ownerServerId?: string
  positionData?: Record<string, unknown>
  threatLevel?: number
}

export class AiRuntimeRepository {
  constructor(private readonly pool: AiRuntimePool) {}

  async findByEntityId(entityId: string): Promise<AtcAiRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiRuntimeRow[]>(
        'SELECT * FROM atc_ai_runtime WHERE entity_id = ?',
        [entityId],
      )
      const row = rows[0]
      return row !== undefined ? rowToRuntime(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcAiRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiRuntimeRow[]>(
        "SELECT * FROM atc_ai_runtime WHERE ai_state NOT IN ('dead')",
        [],
      )
      return rows.map(rowToRuntime)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertAiRuntimeParams): Promise<AtcAiRuntime> {
    const {
      entityId,
      entityType,
      aiState = 'idle',
      behaviorMode = 'passive',
      ownerServerId = null,
      positionData = {},
      threatLevel = 0,
    } = params

    const id = generateId()
    const positionJson = JSON.stringify(positionData)

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ai_runtime
           (id, entity_id, entity_type, ai_state, behavior_mode, owner_server_id, position_data, threat_level, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           ai_state = VALUES(ai_state),
           behavior_mode = VALUES(behavior_mode),
           threat_level = VALUES(threat_level),
           last_tick_at = NOW(3),
           updated_at = NOW(3)`,
        [id, entityId, entityType, aiState, behaviorMode, ownerServerId, positionJson, threatLevel],
      )
      const result = await this.findByEntityId(entityId)
      return result!
    } finally {
      conn.release()
    }
  }

  async updateState(entityId: string, aiState: AtcAiState): Promise<AtcAiRuntime> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.execute<AtcAiRuntimeRow[]>(
        'SELECT * FROM atc_ai_runtime WHERE entity_id = ? FOR UPDATE',
        [entityId],
      )
      if (rows.length === 0) {
        throw new AiEntityNotFoundError(entityId)
      }
      await conn.execute(
        'UPDATE atc_ai_runtime SET ai_state = ?, updated_at = NOW(3) WHERE entity_id = ?',
        [aiState, entityId],
      )
      await conn.commit()
      committed = true
      const result = await this.findByEntityId(entityId)
      return result!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcAiRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const [rows] = await conn.execute<AtcAiRuntimeRow[]>(
        `SELECT * FROM atc_ai_runtime
         WHERE ai_state NOT IN ('dead')
           AND last_tick_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        [thresholdSec],
      )
      return rows.map(rowToRuntime)
    } finally {
      conn.release()
    }
  }

  async deleteByEntityId(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute('DELETE FROM atc_ai_runtime WHERE entity_id = ?', [entityId])
    } finally {
      conn.release()
    }
  }
}
