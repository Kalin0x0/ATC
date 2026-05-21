import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { FactionPool } from './pool.js'
import { generateId } from './id.js'
import { ConflictAlreadyActiveError, ConflictNotFoundError, ConflictImmutableError } from './errors.js'

export type AtcConflictType = 'territory_capture' | 'resource_dispute' | 'retaliation' | 'war' | 'skirmish'
export type AtcConflictStatus = 'active' | 'resolved' | 'aborted' | 'stalemate'
export type AtcConflictOutcome = 'attacker_won' | 'defender_won' | 'stalemate' | 'aborted'

export interface AtcFactionConflict {
  id: string
  territoryId: string
  attackerFactionId: string
  defenderFactionId: string | null
  initiatingPrincipalId: string
  conflictType: AtcConflictType
  status: AtcConflictStatus
  outcome: AtcConflictOutcome | null
  conflictNonce: string
  participants: string[]
  startedAt: Date
  endedAt: Date | null
  notes: string | null
}

interface ConflictRow extends RowDataPacket {
  id: string
  territory_id: string
  attacker_faction_id: string
  defender_faction_id: string | null
  initiating_principal_id: string
  conflict_type: string
  status: string
  outcome: string | null
  conflict_nonce: string
  participants: string
  started_at: Date
  ended_at: Date | null
  notes: string | null
}

function rowToConflict(row: ConflictRow): AtcFactionConflict {
  let participants: string[] = []
  try {
    participants = JSON.parse(row.participants) as string[]
  } catch {
    participants = []
  }
  return {
    id: row.id,
    territoryId: row.territory_id,
    attackerFactionId: row.attacker_faction_id,
    defenderFactionId: row.defender_faction_id,
    initiatingPrincipalId: row.initiating_principal_id,
    conflictType: row.conflict_type as AtcConflictType,
    status: row.status as AtcConflictStatus,
    outcome: row.outcome as AtcConflictOutcome | null,
    conflictNonce: row.conflict_nonce,
    participants,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    notes: row.notes,
  }
}

const ALLOWED_CONFLICT_TRANSITIONS: Record<AtcConflictStatus, AtcConflictStatus[]> = {
  active: ['resolved', 'aborted', 'stalemate'],
  resolved: [],
  aborted: [],
  stalemate: [],
}

export interface CreateConflictParams {
  territoryId: string
  attackerFactionId: string
  defenderFactionId?: string | null | undefined
  initiatingPrincipalId: string
  conflictType?: AtcConflictType
  conflictNonce: string
  participants?: string[]
  notes?: string | null | undefined
}

export interface TransitionConflictOpts {
  notes?: string | null | undefined
}

export class FactionConflictRepository {
  constructor(private readonly pool: FactionPool) {}

  async create(params: CreateConflictParams): Promise<AtcFactionConflict> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [existingRows] = await conn.execute<ConflictRow[]>(
        "SELECT * FROM atc_faction_conflicts WHERE territory_id = ? AND status = 'active' FOR UPDATE",
        [params.territoryId],
      )
      if (existingRows[0]) {
        await conn.rollback()
        throw new ConflictAlreadyActiveError(params.territoryId)
      }

      const id = generateId()
      const conflictType = params.conflictType ?? 'territory_capture'
      const defenderFactionId = params.defenderFactionId ?? null
      const participants = JSON.stringify(params.participants ?? [])
      const notes = params.notes ?? null

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_faction_conflicts
             (id, territory_id, attacker_faction_id, defender_faction_id, initiating_principal_id, conflict_type, status, outcome, conflict_nonce, participants, started_at, ended_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?, NOW(3), NULL, ?)`,
          [id, params.territoryId, params.attackerFactionId, defenderFactionId, params.initiatingPrincipalId, conflictType, params.conflictNonce, participants, notes],
        )
      } catch (err: unknown) {
        await conn.rollback()
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new ConflictAlreadyActiveError(params.territoryId)
        }
        throw err
      }

      const [rows] = await conn.execute<ConflictRow[]>(
        'SELECT * FROM atc_faction_conflicts WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToConflict(rows[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFactionConflict | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ConflictRow[]>(
        'SELECT * FROM atc_faction_conflicts WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToConflict(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveConflict(territoryId: string): Promise<AtcFactionConflict | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ConflictRow[]>(
        "SELECT * FROM atc_faction_conflicts WHERE territory_id = ? AND status = 'active' LIMIT 1",
        [territoryId],
      )
      return rows[0] ? rowToConflict(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(id: string, status: AtcConflictStatus, outcome?: AtcConflictOutcome | null, opts?: TransitionConflictOpts): Promise<AtcFactionConflict> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<ConflictRow[]>(
        'SELECT * FROM atc_faction_conflicts WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) {
        await conn.rollback()
        throw new ConflictNotFoundError(id)
      }

      const current = row.status as AtcConflictStatus
      const allowed = ALLOWED_CONFLICT_TRANSITIONS[current]
      if (!allowed.includes(status)) {
        await conn.rollback()
        throw new ConflictImmutableError(id, current, status)
      }

      const notes = opts?.notes ?? null
      const resolvedOutcome = outcome ?? null

      await conn.execute(
        `UPDATE atc_faction_conflicts
         SET status = ?, outcome = ?, ended_at = NOW(3), notes = COALESCE(?, notes)
         WHERE id = ?`,
        [status, resolvedOutcome, notes, id],
      )

      const [updated] = await conn.execute<ConflictRow[]>(
        'SELECT * FROM atc_faction_conflicts WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToConflict(updated[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async listActiveConflicts(): Promise<AtcFactionConflict[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ConflictRow[]>(
        "SELECT * FROM atc_faction_conflicts WHERE status = 'active' ORDER BY started_at ASC",
      )
      return rows.map(rowToConflict)
    } finally {
      conn.release()
    }
  }

  async cleanStale(olderThanMinutes: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_faction_conflicts
         SET status = 'stalemate', outcome = 'stalemate', ended_at = NOW(3)
         WHERE status = 'active'
           AND started_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
        [olderThanMinutes],
      )
      await conn.commit()
      return result.affectedRows
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }
}
