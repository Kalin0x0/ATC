import type { RowDataPacket } from 'mysql2/promise'
import type { AtcCombatInjury, AtcCombatBodyRegion, AtcInjurySeverity } from '@atc/shared-types'
import type { CombatPool } from './pool.js'
import { generateId } from './id.js'
import { InjuryNotFoundError } from './errors.js'

interface InjuryRow extends RowDataPacket {
  id: string
  principal_id: string
  body_region: string
  severity: string
  source_damage_event_id: string | null
  applied_at: Date
  resolved_at: Date | null
}

function rowToInjury(row: InjuryRow): AtcCombatInjury {
  return {
    id: row.id,
    principalId: row.principal_id,
    bodyRegion: row.body_region as AtcCombatBodyRegion,
    severity: row.severity as AtcInjurySeverity,
    sourceDamageEventId: row.source_damage_event_id,
    appliedAt: row.applied_at,
    resolvedAt: row.resolved_at,
  }
}

export interface RecordInjuryParams {
  principalId: string
  bodyRegion: AtcCombatBodyRegion
  severity: AtcInjurySeverity
  sourceDamageEventId?: string | null | undefined
}

export class InjuryRepository {
  constructor(private readonly pool: CombatPool) {}

  async record(params: RecordInjuryParams): Promise<AtcCombatInjury> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_injury_runtime
           (id, principal_id, body_region, severity, source_damage_event_id, applied_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.principalId,
          params.bodyRegion,
          params.severity,
          params.sourceDamageEventId ?? null,
        ],
      )
      const [rows] = await conn.execute<InjuryRow[]>(
        `SELECT * FROM atc_injury_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      return rowToInjury(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcCombatInjury | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InjuryRow[]>(
        `SELECT * FROM atc_injury_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToInjury(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActive(principalId: string): Promise<AtcCombatInjury[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InjuryRow[]>(
        `SELECT * FROM atc_injury_runtime
         WHERE principal_id = ? AND resolved_at IS NULL
         ORDER BY applied_at DESC`,
        [principalId],
      )
      return rows.map(rowToInjury)
    } finally {
      conn.release()
    }
  }

  async resolve(
    id: string,
    conn?: Awaited<ReturnType<CombatPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      if (owned) {
        await connection.beginTransaction()
      }
      try {
        const [rows] = await connection.execute<InjuryRow[]>(
          `SELECT * FROM atc_injury_runtime WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new InjuryNotFoundError(id)

        await connection.execute(
          `UPDATE atc_injury_runtime SET resolved_at = NOW(3) WHERE id = ?`,
          [id],
        )
        if (owned) await connection.commit()
      } catch (err) {
        if (owned) await connection.rollback()
        throw err
      }
    } finally {
      if (owned) connection.release()
    }
  }

  async resolveAll(principalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_injury_runtime
         SET resolved_at = NOW(3)
         WHERE principal_id = ? AND resolved_at IS NULL`,
        [principalId],
      )
    } finally {
      conn.release()
    }
  }
}
