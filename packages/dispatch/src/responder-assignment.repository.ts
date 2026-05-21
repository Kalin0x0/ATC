import type { RowDataPacket } from 'mysql2/promise'
import type { AtcResponderAssignment, AtcResponderStatus } from '@atc/shared-types'
import type { DispatchPool } from './pool.js'
import { generateId } from './id.js'
import {
  ResponderAssignmentNotFoundError,
  ResponderAssignmentImmutableError,
} from './errors.js'

interface ResponderRow extends RowDataPacket {
  id: string
  incident_id: string
  principal_id: string
  character_id: string | null
  agency_id: string
  status: string
  assigned_at: Date
  status_updated_at: Date
  cleared_at: Date | null
}

function rowToAssignment(row: ResponderRow): AtcResponderAssignment {
  return {
    id: row.id,
    incidentId: row.incident_id,
    principalId: row.principal_id,
    characterId: row.character_id,
    agencyId: row.agency_id,
    status: row.status as AtcResponderStatus,
    assignedAt: row.assigned_at,
    statusUpdatedAt: row.status_updated_at,
    clearedAt: row.cleared_at,
  }
}

export interface CreateResponderAssignmentParams {
  incidentId: string
  principalId: string
  characterId?: string | null | undefined
  agencyId: string
}

// Allowed transitions map
const ALLOWED_TRANSITIONS: Record<AtcResponderStatus, AtcResponderStatus[]> = {
  assigned:    ['enroute', 'on_scene', 'unavailable', 'cleared'],
  enroute:     ['on_scene', 'unavailable', 'cleared'],
  on_scene:    ['unavailable', 'cleared'],
  unavailable: ['cleared'],
  cleared:     [],
}

export class ResponderAssignmentRepository {
  constructor(private readonly pool: DispatchPool) {}

  async create(params: CreateResponderAssignmentParams): Promise<AtcResponderAssignment> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_responder_assignments
           (id, incident_id, principal_id, character_id, agency_id,
            status, assigned_at, status_updated_at)
         VALUES (?, ?, ?, ?, ?, 'assigned', NOW(3), NOW(3))`,
        [id, params.incidentId, params.principalId, params.characterId ?? null, params.agencyId],
      )
      const assignment = await this._findById(conn, id)
      if (!assignment) throw new ResponderAssignmentNotFoundError(id)
      return assignment
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, newStatus: AtcResponderStatus): Promise<AtcResponderAssignment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ResponderRow[]>(
          `SELECT * FROM atc_responder_assignments WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const current = rows[0] ? rowToAssignment(rows[0]) : null
        if (!current) throw new ResponderAssignmentNotFoundError(id)

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(newStatus)) {
          throw new ResponderAssignmentImmutableError(id, current.status)
        }

        const clearedAt = newStatus === 'cleared' ? 'NOW(3)' : 'NULL'
        await conn.execute(
          `UPDATE atc_responder_assignments
           SET status = ?, status_updated_at = NOW(3), cleared_at = ${clearedAt}
           WHERE id = ?`,
          [newStatus, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, id)
      if (!updated) throw new ResponderAssignmentNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcResponderAssignment | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async listByIncident(incidentId: string): Promise<AtcResponderAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResponderRow[]>(
        `SELECT * FROM atc_responder_assignments WHERE incident_id = ? ORDER BY assigned_at ASC`,
        [incidentId],
      )
      return rows.map(rowToAssignment)
    } finally {
      conn.release()
    }
  }

  async listActiveByPrincipal(principalId: string): Promise<AtcResponderAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ResponderRow[]>(
        `SELECT * FROM atc_responder_assignments
         WHERE principal_id = ? AND status != 'cleared'
         ORDER BY assigned_at DESC`,
        [principalId],
      )
      return rows.map(rowToAssignment)
    } finally {
      conn.release()
    }
  }

  private async _findById(conn: Awaited<ReturnType<DispatchPool['getConnection']>>, id: string): Promise<AtcResponderAssignment | null> {
    const [rows] = await conn.execute<ResponderRow[]>(
      `SELECT * FROM atc_responder_assignments WHERE id = ? LIMIT 1`, [id],
    )
    return rows[0] ? rowToAssignment(rows[0]) : null
  }
}
