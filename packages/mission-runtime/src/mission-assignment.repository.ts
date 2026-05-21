import type { RowDataPacket } from 'mysql2/promise'
import type { MissionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { AssignmentAlreadyExistsError, AssignmentNotFoundError } from './errors.js'

export type AtcAssigneeType = 'player' | 'group' | 'npc' | 'server'
export type AtcAssignmentRole = 'owner' | 'participant' | 'observer'

export interface AtcMissionAssignment {
  id: string
  assignmentId: string
  missionId: string
  assigneeId: string
  assigneeType: AtcAssigneeType
  role: AtcAssignmentRole
  assignedAt: Date
  releasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface AssignmentRow extends RowDataPacket {
  id: string
  assignment_id: string
  mission_id: string
  assignee_id: string
  assignee_type: string
  role: string
  assigned_at: Date
  released_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AssignmentRow): AtcMissionAssignment {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    missionId: row.mission_id,
    assigneeId: row.assignee_id,
    assigneeType: row.assignee_type as AtcAssigneeType,
    role: row.role as AtcAssignmentRole,
    assignedAt: row.assigned_at,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class MissionAssignmentRepository {
  constructor(private readonly pool: MissionRuntimePool) {}

  async findByMissionAndAssignee(
    missionId: string,
    assigneeId: string,
  ): Promise<AtcMissionAssignment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AssignmentRow[]>(
        'SELECT * FROM atc_mission_assignments WHERE mission_id = ? AND assignee_id = ? LIMIT 1',
        [missionId, assigneeId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listByMission(missionId: string): Promise<AtcMissionAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AssignmentRow[]>(
        'SELECT * FROM atc_mission_assignments WHERE mission_id = ? ORDER BY created_at ASC',
        [missionId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listByAssignee(assigneeId: string): Promise<AtcMissionAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AssignmentRow[]>(
        'SELECT * FROM atc_mission_assignments WHERE assignee_id = ? ORDER BY created_at ASC',
        [assigneeId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async assign(
    missionId: string,
    assigneeId: string,
    assigneeType: AtcAssigneeType,
    role: AtcAssignmentRole,
  ): Promise<AtcMissionAssignment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const assignmentId = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        assignmentId,
        missionId,
        assigneeId,
        assigneeType,
        role,
      ]
      await conn.execute<AssignmentRow[]>(
        `INSERT INTO atc_mission_assignments
         (id, assignment_id, mission_id, assignee_id, assignee_type, role, assigned_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
        binds,
      )
      const assignment = await this.findByMissionAndAssignee(missionId, assigneeId)
      if (!assignment) throw new AssignmentNotFoundError(missionId, assigneeId)
      return assignment
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new AssignmentAlreadyExistsError(missionId, assigneeId)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async release(missionId: string, assigneeId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<AssignmentRow[]>(
        'UPDATE atc_mission_assignments SET released_at = NOW(3), updated_at = NOW(3) WHERE mission_id = ? AND assignee_id = ?',
        [missionId, assigneeId],
      )
    } finally {
      conn.release()
    }
  }

  async deleteByMission(missionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<AssignmentRow[]>(
        'DELETE FROM atc_mission_assignments WHERE mission_id = ?',
        [missionId],
      )
    } finally {
      conn.release()
    }
  }
}
