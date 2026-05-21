import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import { DuplicatePatrolNonceError, PatrolNotFoundError } from './errors.js'
import type { AiRuntimePool } from './pool.js'

export type AtcPatrolType = 'foot' | 'vehicle' | 'air' | 'water' | 'static' | 'custom'
export type AtcPatrolStatus = 'pending' | 'active' | 'completed' | 'aborted' | 'lost'

export interface AtcAiPatrol {
  id: string
  patrolId: string
  patrolNonce: string
  entityId: string
  patrolType: AtcPatrolType
  status: AtcPatrolStatus
  routeData: Record<string, unknown>
  ownerServerId: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface AtcAiPatrolRow extends RowDataPacket {
  id: string
  patrol_id: string
  patrol_nonce: string
  entity_id: string
  patrol_type: string
  status: string
  route_data: string
  owner_server_id: string | null
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToPatrol(row: AtcAiPatrolRow): AtcAiPatrol {
  return {
    id: row.id,
    patrolId: row.patrol_id,
    patrolNonce: row.patrol_nonce,
    entityId: row.entity_id,
    patrolType: row.patrol_type as AtcPatrolType,
    status: row.status as AtcPatrolStatus,
    routeData: JSON.parse(row.route_data || '{}') as Record<string, unknown>,
    ownerServerId: row.owner_server_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreatePatrolParams {
  patrolNonce: string
  entityId: string
  patrolType: AtcPatrolType
  routeData?: Record<string, unknown>
  ownerServerId?: string
}

export class AiPatrolRepository {
  constructor(private readonly pool: AiRuntimePool) {}

  async findById(patrolId: string): Promise<AtcAiPatrol | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiPatrolRow[]>(
        'SELECT * FROM atc_ai_patrols WHERE patrol_id = ?',
        [patrolId],
      )
      const row = rows[0]
      return row !== undefined ? rowToPatrol(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcAiPatrol[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiPatrolRow[]>(
        "SELECT * FROM atc_ai_patrols WHERE status IN ('pending', 'active')",
        [],
      )
      return rows.map(rowToPatrol)
    } finally {
      conn.release()
    }
  }

  async listByEntity(entityId: string): Promise<AtcAiPatrol[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcAiPatrolRow[]>(
        'SELECT * FROM atc_ai_patrols WHERE entity_id = ?',
        [entityId],
      )
      return rows.map(rowToPatrol)
    } finally {
      conn.release()
    }
  }

  async create(params: CreatePatrolParams): Promise<AtcAiPatrol> {
    const {
      patrolNonce,
      entityId,
      patrolType,
      routeData = {},
      ownerServerId = null,
    } = params

    const id = generateId()
    const patrolId = generateId()
    const routeJson = JSON.stringify(routeData)

    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ai_patrols
           (id, patrol_id, patrol_nonce, entity_id, patrol_type, status, route_data, owner_server_id, started_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL, NOW(3), NOW(3))`,
        [id, patrolId, patrolNonce, entityId, patrolType, routeJson, ownerServerId],
      )
      const result = await this.findById(patrolId)
      return result!
    } catch (err: unknown) {
      if (isDbError(err) && err.code === 'ER_DUP_ENTRY') {
        throw new DuplicatePatrolNonceError(patrolNonce)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async transition(patrolId: string, status: AtcPatrolStatus): Promise<AtcAiPatrol> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.execute<AtcAiPatrolRow[]>(
        'SELECT * FROM atc_ai_patrols WHERE patrol_id = ? FOR UPDATE',
        [patrolId],
      )
      if (rows.length === 0) {
        throw new PatrolNotFoundError(patrolId)
      }

      if (status === 'active') {
        await conn.execute(
          'UPDATE atc_ai_patrols SET status = ?, started_at = NOW(3), updated_at = NOW(3) WHERE patrol_id = ?',
          [status, patrolId],
        )
      } else if (status === 'completed' || status === 'aborted' || status === 'lost') {
        await conn.execute(
          'UPDATE atc_ai_patrols SET status = ?, completed_at = NOW(3), updated_at = NOW(3) WHERE patrol_id = ?',
          [status, patrolId],
        )
      } else {
        await conn.execute(
          'UPDATE atc_ai_patrols SET status = ?, updated_at = NOW(3) WHERE patrol_id = ?',
          [status, patrolId],
        )
      }

      await conn.commit()
      committed = true
      const result = await this.findById(patrolId)
      return result!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcAiPatrol[]> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const [rows] = await conn.execute<AtcAiPatrolRow[]>(
        `SELECT * FROM atc_ai_patrols
         WHERE status IN ('pending', 'active')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        [thresholdSec],
      )
      return rows.map(rowToPatrol)
    } finally {
      conn.release()
    }
  }

  async deleteById(patrolId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute('DELETE FROM atc_ai_patrols WHERE patrol_id = ?', [patrolId])
    } finally {
      conn.release()
    }
  }
}

function isDbError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && 'code' in err
}
