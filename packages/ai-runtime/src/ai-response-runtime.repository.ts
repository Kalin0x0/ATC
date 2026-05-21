import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import { AiResponseNotFoundError } from './errors.js'
import type { AiRuntimePool } from './pool.js'

export type AtcAiResponseType = 'pursuit' | 'combat' | 'investigation' | 'evacuation' | 'lockdown' | 'suppression' | 'custom'
export type AtcAiResponseStatus = 'activating' | 'active' | 'completed' | 'failed' | 'withdrawn'

export interface AtcAiResponseRuntime {
  id: string
  responseId: string
  entityId: string
  responseType: AtcAiResponseType
  status: AtcAiResponseStatus
  targetId: string | null
  tacticalData: Record<string, unknown>
  ownerServerId: string | null
  activatedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface AtcAiResponseRuntimeRow extends RowDataPacket {
  id: string
  response_id: string
  entity_id: string
  response_type: string
  status: string
  target_id: string | null
  tactical_data: string
  owner_server_id: string | null
  activated_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToResponse(row: AtcAiResponseRuntimeRow): AtcAiResponseRuntime {
  return {
    id: row.id,
    responseId: row.response_id,
    entityId: row.entity_id,
    responseType: row.response_type as AtcAiResponseType,
    status: row.status as AtcAiResponseStatus,
    targetId: row.target_id,
    tacticalData: JSON.parse(row.tactical_data || '{}') as Record<string, unknown>,
    ownerServerId: row.owner_server_id,
    activatedAt: row.activated_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateAiResponseParams {
  responseId?: string
  entityId: string
  responseType: AtcAiResponseType
  targetId?: string
  tacticalData?: Record<string, unknown>
  ownerServerId?: string
}

export class AiResponseRuntimeRepository {
  constructor(private readonly pool: AiRuntimePool) {}

  async findById(responseId: string): Promise<AtcAiResponseRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiResponseRuntimeRow[]>(
        'SELECT * FROM atc_ai_response_runtime WHERE response_id = ?',
        [responseId],
      )
      const row = rows[0]
      return row !== undefined ? rowToResponse(row) : null
    } finally {
      conn.release()
    }
  }

  async listActiveByEntity(entityId: string): Promise<AtcAiResponseRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiResponseRuntimeRow[]>(
        "SELECT * FROM atc_ai_response_runtime WHERE entity_id = ? AND status IN ('activating', 'active')",
        [entityId],
      )
      return rows.map(rowToResponse)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateAiResponseParams): Promise<AtcAiResponseRuntime> {
    const {
      entityId,
      responseType,
      tacticalData = {},
      ownerServerId = null,
    } = params

    const id = generateId()
    const responseId = params.responseId ?? generateId()
    const targetId = params.targetId ?? null
    const tacticalJson = JSON.stringify(tacticalData)

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ai_response_runtime
           (id, response_id, entity_id, response_type, status, target_id, tactical_data, owner_server_id, activated_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'activating', ?, ?, ?, NULL, NULL, NOW(3), NOW(3))`,
        [id, responseId, entityId, responseType, targetId, tacticalJson, ownerServerId],
      )
      const result = await this.findById(responseId)
      return result!
    } finally {
      conn.release()
    }
  }

  async transition(responseId: string, status: AtcAiResponseStatus): Promise<AtcAiResponseRuntime> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.execute<AtcAiResponseRuntimeRow[]>(
        'SELECT * FROM atc_ai_response_runtime WHERE response_id = ? FOR UPDATE',
        [responseId],
      )
      if (rows.length === 0) {
        throw new AiResponseNotFoundError(responseId)
      }

      if (status === 'active') {
        await conn.execute(
          'UPDATE atc_ai_response_runtime SET status = ?, activated_at = NOW(3), updated_at = NOW(3) WHERE response_id = ?',
          [status, responseId],
        )
      } else if (status === 'completed' || status === 'failed' || status === 'withdrawn') {
        await conn.execute(
          'UPDATE atc_ai_response_runtime SET status = ?, completed_at = NOW(3), updated_at = NOW(3) WHERE response_id = ?',
          [status, responseId],
        )
      } else {
        await conn.execute(
          'UPDATE atc_ai_response_runtime SET status = ?, updated_at = NOW(3) WHERE response_id = ?',
          [status, responseId],
        )
      }

      await conn.commit()
      committed = true
      const result = await this.findById(responseId)
      return result!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcAiResponseRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const [rows] = await conn.execute<AtcAiResponseRuntimeRow[]>(
        `SELECT * FROM atc_ai_response_runtime
         WHERE status IN ('activating', 'active')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        [thresholdSec],
      )
      return rows.map(rowToResponse)
    } finally {
      conn.release()
    }
  }

  async deleteById(responseId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        'DELETE FROM atc_ai_response_runtime WHERE response_id = ?',
        [responseId],
      )
    } finally {
      conn.release()
    }
  }
}
