import type { RowDataPacket } from 'mysql2/promise'
import type { AtcCombatSession, AtcCombatSessionStatus } from '@atc/shared-types'
import type { CombatPool } from './pool.js'
import { generateId } from './id.js'
import { CombatSessionNotFoundError, CombatSessionEndedError } from './errors.js'

interface CombatSessionRow extends RowDataPacket {
  id: string
  initiator_principal_id: string
  status: string
  outcome: string | null
  started_at: Date
  ended_at: Date | null
  participant_count: number
  created_at: Date
}

function rowToSession(row: CombatSessionRow): AtcCombatSession {
  return {
    id: row.id,
    initiatorPrincipalId: row.initiator_principal_id,
    status: row.status as AtcCombatSessionStatus,
    outcome: row.outcome,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    participantCount: row.participant_count,
    createdAt: row.created_at,
  }
}

export class CombatSessionRepository {
  constructor(private readonly pool: CombatPool) {}

  async create(initiatorPrincipalId: string): Promise<AtcCombatSession> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_combat_sessions
           (id, initiator_principal_id, status, participant_count, started_at, created_at)
         VALUES (?, ?, 'active', 1, NOW(3), NOW(3))`,
        [id, initiatorPrincipalId],
      )
      const session = await this._findById(conn, id)
      if (!session) throw new CombatSessionNotFoundError(id)
      return session
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<CombatPool['getConnection']>>,
  ): Promise<AtcCombatSession | null> {
    if (conn) {
      return this._findById(conn, id)
    }
    const connection = await this.pool.getConnection()
    try {
      return this._findById(connection, id)
    } finally {
      connection.release()
    }
  }

  async end(id: string, outcome?: string | undefined): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<CombatSessionRow[]>(
          `SELECT * FROM atc_combat_sessions WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const current = rows[0] ? rowToSession(rows[0]) : null
        if (!current) throw new CombatSessionNotFoundError(id)
        if (current.status !== 'active') {
          throw new CombatSessionEndedError(id)
        }

        await conn.execute(
          `UPDATE atc_combat_sessions
           SET status = 'ended',
               ended_at = NOW(3),
               outcome = COALESCE(?, outcome)
           WHERE id = ?`,
          [outcome ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async abandon(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<CombatSessionRow[]>(
          `SELECT * FROM atc_combat_sessions WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const current = rows[0] ? rowToSession(rows[0]) : null
        if (!current) throw new CombatSessionNotFoundError(id)
        if (current.status !== 'active') {
          throw new CombatSessionEndedError(id)
        }

        await conn.execute(
          `UPDATE atc_combat_sessions
           SET status = 'abandoned', ended_at = NOW(3)
           WHERE id = ?`,
          [id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async incrementParticipants(
    id: string,
    conn?: Awaited<ReturnType<CombatPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_combat_sessions
         SET participant_count = participant_count + 1
         WHERE id = ?`,
        [id],
      )
    } finally {
      if (owned) connection.release()
    }
  }

  async listActive(): Promise<AtcCombatSession[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CombatSessionRow[]>(
        `SELECT * FROM atc_combat_sessions WHERE status = 'active' ORDER BY started_at DESC`,
      )
      return rows.map(rowToSession)
    } finally {
      conn.release()
    }
  }

  async cleanStale(olderThanMinutes: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_combat_sessions
         SET status = 'abandoned', ended_at = NOW(3)
         WHERE status = 'active'
           AND started_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
        [olderThanMinutes],
      )
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CombatPool['getConnection']>>,
    id: string,
  ): Promise<AtcCombatSession | null> {
    const [rows] = await conn.execute<CombatSessionRow[]>(
      `SELECT * FROM atc_combat_sessions WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToSession(rows[0]) : null
  }
}
