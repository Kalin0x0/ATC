import type { RowDataPacket } from 'mysql2/promise'
import type { AtcRaid, AtcRaidStatus, AtcRaidOutcome } from '@atc/shared-types'
import type { CriminalPool } from './pool.js'
import { generateId } from './id.js'
import { RaidNotFoundError, RaidImmutableError, RaidAlreadyActiveError } from './errors.js'

interface RaidRow extends RowDataPacket {
  id: string
  property_id: string
  initiating_agency_id: string | null
  lead_principal_id: string
  status: string
  outcome: string | null
  participants: string
  started_at: Date | null
  ended_at: Date | null
  notes: string | null
  created_at: Date
  updated_at: Date
}

function rowToRaid(row: RaidRow): AtcRaid {
  return {
    id: row.id,
    propertyId: row.property_id,
    initiatingAgencyId: row.initiating_agency_id,
    leadPrincipalId: row.lead_principal_id,
    status: row.status as AtcRaidStatus,
    outcome: row.outcome as AtcRaidOutcome | null,
    participants: JSON.parse(row.participants) as string[],
    startedAt: row.started_at,
    endedAt: row.ended_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcRaidStatus, AtcRaidStatus[]> = {
  staging:   ['active', 'aborted'],
  active:    ['completed', 'aborted'],
  completed: [],
  aborted:   [],
}

export interface CreateRaidParams {
  propertyId: string
  initiatingAgencyId?: string | null | undefined
  leadPrincipalId: string
  participants: string[]
  notes?: string | undefined
}

export interface TransitionRaidOpts {
  outcome?: AtcRaidOutcome | undefined
  notes?: string | undefined
}

export class RaidRepository {
  constructor(private readonly pool: CriminalPool) {}

  async create(params: CreateRaidParams): Promise<AtcRaid> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        // Check for active raids on same property
        const [existing] = await conn.execute<RaidRow[]>(
          `SELECT id FROM atc_raids
           WHERE property_id = ? AND status IN ('staging', 'active')
           LIMIT 1 FOR UPDATE`,
          [params.propertyId],
        )
        if (existing[0]) throw new RaidAlreadyActiveError(params.propertyId)

        await conn.execute(
          `INSERT INTO atc_raids
             (id, property_id, initiating_agency_id, lead_principal_id, status, participants, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'staging', ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.propertyId,
            params.initiatingAgencyId ?? null,
            params.leadPrincipalId,
            JSON.stringify(params.participants),
            params.notes ?? null,
          ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const raid = await this._findById(conn, id)
      if (!raid) throw new RaidNotFoundError(id)
      return raid
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<AtcRaid | null> {
    if (conn) {
      return this._findById(conn, id)
    }
    const c = await this.pool.getConnection()
    try {
      return this._findById(c, id)
    } finally {
      c.release()
    }
  }

  async transition(
    id: string,
    toStatus: AtcRaidStatus,
    opts?: TransitionRaidOpts,
  ): Promise<AtcRaid> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<RaidRow[]>(
          `SELECT * FROM atc_raids WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new RaidNotFoundError(id)
        const current = rowToRaid(rows[0])

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(toStatus)) {
          throw new RaidImmutableError(id, current.status, toStatus)
        }

        const now = new Date()
        const startedAt = toStatus === 'active' ? now : current.startedAt
        const endedAt =
          toStatus === 'completed' || toStatus === 'aborted' ? now : current.endedAt

        await conn.execute(
          `UPDATE atc_raids
           SET status = ?, outcome = COALESCE(?, outcome), notes = COALESCE(?, notes),
               started_at = ?, ended_at = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [
            toStatus,
            opts?.outcome ?? null,
            opts?.notes ?? null,
            startedAt ?? null,
            endedAt ?? null,
            id,
          ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, id)
      if (!updated) throw new RaidNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async listByProperty(propertyId: string): Promise<AtcRaid[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RaidRow[]>(
        `SELECT * FROM atc_raids WHERE property_id = ? ORDER BY created_at DESC`,
        [propertyId],
      )
      return rows.map(rowToRaid)
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcRaidStatus): Promise<AtcRaid[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RaidRow[]>(
        `SELECT * FROM atc_raids WHERE status = ? ORDER BY created_at DESC`,
        [status],
      )
      return rows.map(rowToRaid)
    } finally {
      conn.release()
    }
  }

  async listActiveByLead(principalId: string): Promise<AtcRaid[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RaidRow[]>(
        `SELECT * FROM atc_raids
         WHERE lead_principal_id = ? AND status IN ('staging', 'active')
         ORDER BY created_at DESC`,
        [principalId],
      )
      return rows.map(rowToRaid)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CriminalPool['getConnection']>>,
    id: string,
  ): Promise<AtcRaid | null> {
    const [rows] = await conn.execute<RaidRow[]>(
      `SELECT * FROM atc_raids WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToRaid(rows[0]) : null
  }
}
