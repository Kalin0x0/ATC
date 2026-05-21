import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { NarrativeRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { NarrativeSessionNotFoundError } from './errors.js'

export type AtcNarrativeType = 'cutscene' | 'dialogue' | 'mission' | 'event' | 'ambient' | 'custom'
export type AtcNarrativeStatus = 'active' | 'paused' | 'completed' | 'skipped'

export interface AtcNarrativeSession {
  id: string
  sessionId: string
  entityId: string
  campaignId: string | null
  narrativeType: AtcNarrativeType
  status: AtcNarrativeStatus
  ownerServerId: string
  narrativeData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface NarrativeSessionRow extends RowDataPacket {
  id: string
  session_id: string
  entity_id: string
  campaign_id: string | null
  narrative_type: string
  status: string
  owner_server_id: string
  narrative_data: string
  created_at: Date
  updated_at: Date
}

function rowToSession(row: NarrativeSessionRow): AtcNarrativeSession {
  return {
    id: row.id,
    sessionId: row.session_id,
    entityId: row.entity_id,
    campaignId: row.campaign_id,
    narrativeType: row.narrative_type as AtcNarrativeType,
    status: row.status as AtcNarrativeStatus,
    ownerServerId: row.owner_server_id,
    narrativeData: JSON.parse(row.narrative_data) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateNarrativeSessionParams {
  sessionId: string
  entityId: string
  campaignId?: string | null | undefined
  narrativeType: AtcNarrativeType
  ownerServerId: string
  narrativeData?: Record<string, unknown> | undefined
}

export class NarrativeSessionRepository {
  constructor(private readonly pool: NarrativeRuntimePool) {}

  async create(params: CreateNarrativeSessionParams): Promise<AtcNarrativeSession> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_narrative_runtime
             (id, session_id, entity_id, campaign_id, narrative_type, status,
              owner_server_id, narrative_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.sessionId,
            params.entityId,
            params.campaignId ?? null,
            params.narrativeType,
            params.ownerServerId,
            JSON.stringify(params.narrativeData ?? {}),
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new NarrativeSessionNotFoundError(params.sessionId)
        }
        throw err
      }
      const [rows] = await conn.execute<NarrativeSessionRow[]>(
        `SELECT * FROM atc_narrative_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new NarrativeSessionNotFoundError(id)
      return rowToSession(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcNarrativeSession | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NarrativeSessionRow[]>(
        `SELECT * FROM atc_narrative_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToSession(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findBySessionId(sessionId: string): Promise<AtcNarrativeSession | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NarrativeSessionRow[]>(
        `SELECT * FROM atc_narrative_runtime WHERE session_id = ? LIMIT 1`,
        [sessionId],
      )
      return rows[0] ? rowToSession(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcNarrativeStatus): Promise<AtcNarrativeSession> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<NarrativeSessionRow[]>(
          `SELECT * FROM atc_narrative_runtime WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new NarrativeSessionNotFoundError(id)
        await conn.execute(
          `UPDATE atc_narrative_runtime
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<NarrativeSessionRow[]>(
        `SELECT * FROM atc_narrative_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new NarrativeSessionNotFoundError(id)
      return rowToSession(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string | undefined): Promise<AtcNarrativeSession[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<NarrativeSessionRow[]>(
          `SELECT * FROM atc_narrative_runtime
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY created_at DESC`,
          [ownerServerId],
        )
        return rows.map(rowToSession)
      }
      const [rows] = await conn.execute<NarrativeSessionRow[]>(
        `SELECT * FROM atc_narrative_runtime
         WHERE status = 'active'
         ORDER BY created_at DESC`,
      )
      return rows.map(rowToSession)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_narrative_runtime
         WHERE status = 'active'
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        [thresholdSec],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
