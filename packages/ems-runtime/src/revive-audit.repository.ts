import type { RowDataPacket } from 'mysql2/promise'
import type { AtcReviveAudit } from '@atc/shared-types'
import type { EmsPool } from './pool.js'
import { generateId } from './id.js'

interface ReviveAuditRow extends RowDataPacket {
  id: string
  character_id: string
  emergency_id: string | null
  revived_by_principal_id: string
  previous_state: string
  resulting_state: string
  notes: string | null
  revived_at: Date
}

function rowToAudit(row: ReviveAuditRow): AtcReviveAudit {
  return {
    id: row.id,
    characterId: row.character_id,
    emergencyId: row.emergency_id,
    revivedByPrincipalId: row.revived_by_principal_id,
    previousState: row.previous_state,
    resultingState: row.resulting_state,
    notes: row.notes,
    revivedAt: row.revived_at,
  }
}

export interface RecordReviveParams {
  characterId: string
  emergencyId?: string | null | undefined
  revivedByPrincipalId: string
  previousState: string
  resultingState: string
  notes?: string | null | undefined
}

export class ReviveAuditRepository {
  constructor(private readonly pool: EmsPool) {}

  async record(params: RecordReviveParams): Promise<AtcReviveAudit> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ems_revive_audit
           (id, character_id, emergency_id, revived_by_principal_id,
            previous_state, resulting_state, notes, revived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id, params.characterId, params.emergencyId ?? null,
          params.revivedByPrincipalId, params.previousState,
          params.resultingState, params.notes ?? null,
        ],
      )
      const [rows] = await conn.execute<ReviveAuditRow[]>(
        `SELECT * FROM atc_ems_revive_audit WHERE id = ? LIMIT 1`, [id],
      )
      return rowToAudit(rows[0]!)
    } finally {
      conn.release()
    }
  }

  // Find most recent revive within the last N seconds — for cooldown enforcement
  async findRecentRevive(characterId: string, sinceSeconds: number): Promise<AtcReviveAudit | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReviveAuditRow[]>(
        `SELECT * FROM atc_ems_revive_audit
         WHERE character_id = ?
           AND revived_at > DATE_SUB(NOW(3), INTERVAL ? SECOND)
         ORDER BY revived_at DESC
         LIMIT 1`,
        [characterId, sinceSeconds],
      )
      return rows[0] ? rowToAudit(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listForCharacter(characterId: string, limit = 20): Promise<AtcReviveAudit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReviveAuditRow[]>(
        `SELECT * FROM atc_ems_revive_audit WHERE character_id = ? ORDER BY revived_at DESC LIMIT ?`,
        [characterId, Math.min(limit, 100)],
      )
      return rows.map(rowToAudit)
    } finally {
      conn.release()
    }
  }
}
