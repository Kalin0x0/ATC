import type { RowDataPacket } from 'mysql2/promise'
import type { MissionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ObjectiveNotFoundError } from './errors.js'

export type AtcObjectiveType =
  | 'reach'
  | 'collect'
  | 'eliminate'
  | 'protect'
  | 'deliver'
  | 'interact'
  | 'custom'

export type AtcObjectiveStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped'

export interface AtcMissionObjective {
  id: string
  objectiveId: string
  missionId: string
  objectiveType: AtcObjectiveType
  objectiveName: string
  status: AtcObjectiveStatus
  sequenceOrder: number
  completionData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ObjectiveRow extends RowDataPacket {
  id: string
  objective_id: string
  mission_id: string
  objective_type: string
  objective_name: string
  status: string
  sequence_order: number
  completion_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ObjectiveRow): AtcMissionObjective {
  let completionData: Record<string, unknown> = {}
  if (row.completion_data) {
    try {
      completionData = JSON.parse(row.completion_data) as Record<string, unknown>
    } catch {
      completionData = {}
    }
  }
  return {
    id: row.id,
    objectiveId: row.objective_id,
    missionId: row.mission_id,
    objectiveType: row.objective_type as AtcObjectiveType,
    objectiveName: row.objective_name,
    status: row.status as AtcObjectiveStatus,
    sequenceOrder: row.sequence_order,
    completionData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateObjectiveParams {
  objectiveId?: string
  missionId: string
  objectiveType: AtcObjectiveType
  objectiveName: string
  sequenceOrder?: number
  completionData?: Record<string, unknown>
}

export class MissionObjectiveRepository {
  constructor(private readonly pool: MissionRuntimePool) {}

  async findById(objectiveId: string): Promise<AtcMissionObjective | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ObjectiveRow[]>(
        'SELECT * FROM atc_mission_objectives WHERE objective_id = ? LIMIT 1',
        [objectiveId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listByMission(missionId: string): Promise<AtcMissionObjective[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ObjectiveRow[]>(
        'SELECT * FROM atc_mission_objectives WHERE mission_id = ? ORDER BY sequence_order ASC',
        [missionId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateObjectiveParams): Promise<AtcMissionObjective> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const objectiveId = params.objectiveId ?? generateId()
      const completionData = JSON.stringify(params.completionData ?? {})
      const binds: (string | number | boolean | null)[] = [
        id,
        objectiveId,
        params.missionId,
        params.objectiveType,
        params.objectiveName,
        'pending',
        params.sequenceOrder ?? 0,
        completionData,
      ]
      await conn.execute<ObjectiveRow[]>(
        `INSERT INTO atc_mission_objectives
         (id, objective_id, mission_id, objective_type, objective_name, status, sequence_order, completion_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        binds,
      )
      const objective = await this.findById(objectiveId)
      if (!objective) throw new ObjectiveNotFoundError(objectiveId)
      return objective
    } finally {
      conn.release()
    }
  }

  async transition(objectiveId: string, status: AtcObjectiveStatus): Promise<AtcMissionObjective> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<ObjectiveRow[]>(
        'SELECT * FROM atc_mission_objectives WHERE objective_id = ? FOR UPDATE',
        [objectiveId],
      )
      if (rows.length === 0) throw new ObjectiveNotFoundError(objectiveId)

      const completedClause = status === 'completed' ? ', completed_at = NOW(3)' : ''

      await conn.execute<ObjectiveRow[]>(
        `UPDATE atc_mission_objectives SET status = ?, updated_at = NOW(3)${completedClause} WHERE objective_id = ?`,
        [status, objectiveId],
      )

      await conn.commit()
      committed = true

      const objective = await this.findById(objectiveId)
      if (!objective) throw new ObjectiveNotFoundError(objectiveId)
      return objective
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async deleteByMission(missionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ObjectiveRow[]>(
        'DELETE FROM atc_mission_objectives WHERE mission_id = ?',
        [missionId],
      )
    } finally {
      conn.release()
    }
  }
}
