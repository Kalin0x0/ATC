import type { RowDataPacket } from 'mysql2/promise'
import type { AtcJailRecord, AtcJailStatus } from '@atc/shared-types'
import type { LawPool } from './pool.js'
import { generateId } from './id.js'
import { JailRecordNotFoundError, JailAlreadyActiveError } from './errors.js'

interface JailRow extends RowDataPacket {
  id: string
  character_id: string
  arrest_record_id: string
  start_at: Date
  release_at: Date | null
  released_by_principal_id: string | null
  status: string
  created_at: Date
  updated_at: Date
}

function rowToJail(row: JailRow): AtcJailRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    arrestRecordId: row.arrest_record_id,
    startAt: row.start_at,
    releaseAt: row.release_at,
    releasedByPrincipalId: row.released_by_principal_id,
    status: row.status as AtcJailStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface EnterJailParams {
  characterId: string
  arrestRecordId: string
  releaseAt?: Date | null | undefined
}

export class JailRepository {
  constructor(private readonly pool: LawPool) {}

  async enter(params: EnterJailParams): Promise<AtcJailRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Prevent duplicate active jail records — lock under transaction
      const [activeRows] = await conn.execute<JailRow[]>(
        `SELECT id FROM atc_jail_records WHERE character_id = ? AND status = 'active' LIMIT 1 FOR UPDATE`,
        [params.characterId],
      )
      if (activeRows[0]) {
        await conn.rollback()
        throw new JailAlreadyActiveError(params.characterId)
      }

      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_jail_records
           (id, character_id, arrest_record_id, start_at, release_at, status, created_at, updated_at)
         VALUES (?, ?, ?, NOW(3), ?, 'active', NOW(3), NOW(3))`,
        [id, params.characterId, params.arrestRecordId, params.releaseAt ?? null],
      )

      await conn.commit()

      const [rows] = await conn.execute<JailRow[]>(
        'SELECT * FROM atc_jail_records WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new JailRecordNotFoundError(id)
      return rowToJail(rows[0])
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async release(id: string, releasedByPrincipalId: string): Promise<AtcJailRecord> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
        `UPDATE atc_jail_records
         SET status = 'released', release_at = NOW(3), released_by_principal_id = ?, updated_at = NOW(3)
         WHERE id = ? AND status = 'active'`,
        [releasedByPrincipalId, id],
      )
      if (result.affectedRows === 0) {
        const record = await this.findById(id)
        if (!record) throw new JailRecordNotFoundError(id)
      }
      const [rows] = await conn.execute<JailRow[]>(
        'SELECT * FROM atc_jail_records WHERE id = ? LIMIT 1',
        [id],
      )
      if (!rows[0]) throw new JailRecordNotFoundError(id)
      return rowToJail(rows[0])
    } finally {
      conn.release()
    }
  }

  async findActiveForCharacter(characterId: string): Promise<AtcJailRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<JailRow[]>(
        `SELECT * FROM atc_jail_records WHERE character_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [characterId],
      )
      return rows[0] ? rowToJail(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcJailRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<JailRow[]>(
        'SELECT * FROM atc_jail_records WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToJail(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
