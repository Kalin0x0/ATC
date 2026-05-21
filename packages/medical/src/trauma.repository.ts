import type { RowDataPacket } from 'mysql2/promise'
import type { AtcTraumaRecord, AtcTraumaState } from '@atc/shared-types'
import type { MedicalPool } from './pool.js'
import { generateId } from './id.js'
import { TraumaNotFoundError, TraumaImmutableError } from './errors.js'

interface TraumaRow extends RowDataPacket {
  id: string
  character_id: string
  state: string
  previous_state: string | null
  updated_by_principal_id: string
  notes: string | null
  state_changed_at: Date
  created_at: Date
  updated_at: Date
}

function rowToTrauma(row: TraumaRow): AtcTraumaRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    state: row.state as AtcTraumaState,
    previousState: row.previous_state as AtcTraumaState | null,
    updatedByPrincipalId: row.updated_by_principal_id,
    notes: row.notes,
    stateChangedAt: row.state_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Valid state machine transitions
const ALLOWED_TRANSITIONS: Record<AtcTraumaState, AtcTraumaState[]> = {
  stable:         ['bleeding', 'unconscious', 'cardiac_arrest', 'fractured', 'pain_shock', 'deceased'],
  bleeding:       ['unconscious', 'cardiac_arrest', 'stabilized', 'deceased'],
  unconscious:    ['cardiac_arrest', 'stabilized', 'deceased'],
  cardiac_arrest: ['stabilized', 'deceased'],
  fractured:      ['stable', 'stabilized', 'pain_shock'],
  pain_shock:     ['stable', 'stabilized', 'unconscious'],
  stabilized:     ['stable', 'deceased'],
  deceased:       ['stable'], // revive path only
}

export interface UpdateTraumaParams {
  characterId: string
  newState: AtcTraumaState
  updatedByPrincipalId: string
  notes?: string | null | undefined
}

export class TraumaRepository {
  constructor(private readonly pool: MedicalPool) {}

  async getOrCreate(characterId: string, principalId: string): Promise<AtcTraumaRecord> {
    const conn = await this.pool.getConnection()
    try {
      const existing = await this._findByCharacter(conn, characterId)
      if (existing) return existing

      const id = generateId()
      try {
        await conn.execute(
          `INSERT INTO atc_trauma_states
             (id, character_id, state, previous_state, updated_by_principal_id, state_changed_at, created_at, updated_at)
           VALUES (?, ?, 'stable', NULL, ?, NOW(3), NOW(3), NOW(3))`,
          [id, characterId, principalId],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          const retry = await this._findByCharacter(conn, characterId)
          if (retry) return retry
        }
        throw err
      }
      const created = await this._findByCharacter(conn, characterId)
      if (!created) throw new TraumaNotFoundError(characterId)
      return created
    } finally {
      conn.release()
    }
  }

  async findByCharacter(characterId: string): Promise<AtcTraumaRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findByCharacter(conn, characterId)
    } finally {
      conn.release()
    }
  }

  async transition(params: UpdateTraumaParams): Promise<AtcTraumaRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<TraumaRow[]>(
          `SELECT * FROM atc_trauma_states WHERE character_id = ? LIMIT 1 FOR UPDATE`,
          [params.characterId],
        )
        const current = rows[0] ? rowToTrauma(rows[0]) : null
        if (!current) throw new TraumaNotFoundError(params.characterId)

        const allowed = ALLOWED_TRANSITIONS[current.state]
        if (!allowed.includes(params.newState)) {
          throw new TraumaImmutableError(params.characterId, current.state, params.newState)
        }

        await conn.execute(
          `UPDATE atc_trauma_states
           SET state = ?, previous_state = ?, updated_by_principal_id = ?,
               notes = ?, state_changed_at = NOW(3), updated_at = NOW(3)
           WHERE character_id = ?`,
          [params.newState, current.state, params.updatedByPrincipalId, params.notes ?? null, params.characterId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findByCharacter(conn, params.characterId)
      if (!updated) throw new TraumaNotFoundError(params.characterId)
      return updated
    } finally {
      conn.release()
    }
  }

  private async _findByCharacter(conn: Awaited<ReturnType<MedicalPool['getConnection']>>, characterId: string): Promise<AtcTraumaRecord | null> {
    const [rows] = await conn.execute<TraumaRow[]>(
      `SELECT * FROM atc_trauma_states WHERE character_id = ? LIMIT 1`, [characterId],
    )
    return rows[0] ? rowToTrauma(rows[0]) : null
  }
}
