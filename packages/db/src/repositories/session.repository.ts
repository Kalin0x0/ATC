import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import type { AtcLocaleCode, AtcSessionStatus } from '@atc/shared-types'
import { generateId } from '../id.js'

interface SessionRow extends RowDataPacket {
  id: string
  account_id: string
  character_id: string | null
  source: number
  name: string
  primary_identifier: string
  language: string
  state: string
  connected_at: Date
  disconnected_at: Date | null
}

export interface SessionRecord {
  id: string
  accountId: string
  characterId: string | null
  source: number
  name: string
  primaryIdentifier: string
  language: AtcLocaleCode
  state: AtcSessionStatus
  connectedAt: Date
  disconnectedAt: Date | null
}

function rowToSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    characterId: row.character_id ?? null,
    source: row.source,
    name: row.name,
    primaryIdentifier: row.primary_identifier,
    language: row.language as AtcLocaleCode,
    state: row.state as AtcSessionStatus,
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
  }
}

export class SessionRepository {
  constructor(private readonly pool: DbPool) {}

  async create(params: {
    accountId: string
    source: number
    name: string
    primaryIdentifier: string
    language: AtcLocaleCode
  }): Promise<SessionRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_player_sessions
           (id, account_id, source, name, primary_identifier, language, state, connected_at)
         VALUES (?, ?, ?, ?, ?, ?, 'connecting', NOW(3))`,
        [id, params.accountId, params.source, params.name, params.primaryIdentifier, params.language]
      )
      const [rows] = await conn.execute<SessionRow[]>(
        'SELECT * FROM atc_player_sessions WHERE id = ?',
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Session not found after insert: ${id}`)
      return rowToSession(row)
    } finally {
      conn.release()
    }
  }

  async endBySource(source: number): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_player_sessions
         SET state = 'ended', disconnected_at = NOW(3)
         WHERE source = ? AND state != 'ended'`,
        [source]
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  async findBySource(source: number): Promise<SessionRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SessionRow[]>(
        `SELECT * FROM atc_player_sessions
         WHERE source = ? AND state != 'ended'
         ORDER BY connected_at DESC
         LIMIT 1`,
        [source]
      )
      const row = rows[0]
      if (!row) return null
      return rowToSession(row)
    } finally {
      conn.release()
    }
  }

  async findById(sessionId: string): Promise<SessionRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SessionRow[]>(
        'SELECT * FROM atc_player_sessions WHERE id = ?',
        [sessionId]
      )
      const row = rows[0]
      if (!row) return null
      return rowToSession(row)
    } finally {
      conn.release()
    }
  }

  // Returns true when the session was updated. Returns false if the session no longer exists
  // or has already ended (concurrent disconnect). Callers must treat false as a 409.
  async attachCharacter(sessionId: string, characterId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        "UPDATE atc_player_sessions SET character_id = ? WHERE id = ? AND state != 'ended'",
        [characterId, sessionId]
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  async activate(sessionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        "UPDATE atc_player_sessions SET state = 'active' WHERE id = ?",
        [sessionId]
      )
    } finally {
      conn.release()
    }
  }
}
