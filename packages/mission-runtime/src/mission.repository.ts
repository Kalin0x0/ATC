import type { RowDataPacket } from 'mysql2/promise'
import type { MissionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateMissionNonceError, MissionNotFoundError } from './errors.js'

export type AtcMissionType = 'main' | 'side' | 'dynamic' | 'faction' | 'emergency' | 'custom'
export type AtcMissionStatus = 'pending' | 'active' | 'completed' | 'failed' | 'abandoned'

export interface AtcMission {
  id: string
  missionId: string
  missionNonce: string
  missionType: AtcMissionType
  missionName: string
  status: AtcMissionStatus
  ownerServerId: string | null
  ownerPrincipalId: string | null
  configData: Record<string, unknown>
  startedAt: Date | null
  completedAt: Date | null
  failedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface MissionRow extends RowDataPacket {
  id: string
  mission_id: string
  mission_nonce: string
  mission_type: string
  mission_name: string
  status: string
  owner_server_id: string | null
  owner_principal_id: string | null
  config_data: string | null
  started_at: Date | null
  completed_at: Date | null
  failed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: MissionRow): AtcMission {
  let configData: Record<string, unknown> = {}
  if (row.config_data) {
    try {
      configData = JSON.parse(row.config_data) as Record<string, unknown>
    } catch {
      configData = {}
    }
  }
  return {
    id: row.id,
    missionId: row.mission_id,
    missionNonce: row.mission_nonce,
    missionType: row.mission_type as AtcMissionType,
    missionName: row.mission_name,
    status: row.status as AtcMissionStatus,
    ownerServerId: row.owner_server_id,
    ownerPrincipalId: row.owner_principal_id,
    configData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateMissionParams {
  missionNonce: string
  missionType: AtcMissionType
  missionName: string
  ownerServerId?: string
  ownerPrincipalId?: string
  configData?: Record<string, unknown>
}

export class MissionRepository {
  constructor(private readonly pool: MissionRuntimePool) {}

  async findById(missionId: string): Promise<AtcMission | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MissionRow[]>(
        'SELECT * FROM atc_missions WHERE mission_id = ? LIMIT 1',
        [missionId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcMission[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MissionRow[]>(
        "SELECT * FROM atc_missions WHERE status IN ('pending', 'active') ORDER BY created_at ASC",
        [],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async create(params: CreateMissionParams): Promise<AtcMission> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const missionId = generateId()
      const configData = JSON.stringify(params.configData ?? {})
      const binds: (string | number | boolean | null)[] = [
        id,
        missionId,
        params.missionNonce,
        params.missionType,
        params.missionName,
        'pending',
        params.ownerServerId ?? null,
        params.ownerPrincipalId ?? null,
        configData,
      ]
      await conn.execute<MissionRow[]>(
        `INSERT INTO atc_missions
         (id, mission_id, mission_nonce, mission_type, mission_name, status, owner_server_id, owner_principal_id, config_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        binds,
      )
      const mission = await this.findById(missionId)
      if (!mission) throw new MissionNotFoundError(missionId)
      return mission
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new DuplicateMissionNonceError(params.missionNonce)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async transition(missionId: string, status: AtcMissionStatus): Promise<AtcMission> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<MissionRow[]>(
        'SELECT * FROM atc_missions WHERE mission_id = ? FOR UPDATE',
        [missionId],
      )
      if (rows.length === 0) throw new MissionNotFoundError(missionId)

      const timestampClause =
        status === 'active'
          ? ', started_at = NOW(3)'
          : status === 'completed'
            ? ', completed_at = NOW(3)'
            : status === 'failed'
              ? ', failed_at = NOW(3)'
              : ''

      await conn.execute<MissionRow[]>(
        `UPDATE atc_missions SET status = ?, updated_at = NOW(3)${timestampClause} WHERE mission_id = ?`,
        [status, missionId],
      )

      await conn.commit()
      committed = true

      const mission = await this.findById(missionId)
      if (!mission) throw new MissionNotFoundError(missionId)
      return mission
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcMission[]> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const binds: (string | number | boolean | null)[] = [thresholdSec]
      const [rows] = await conn.execute<MissionRow[]>(
        `SELECT * FROM atc_missions
         WHERE status IN ('active', 'pending')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        binds,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteById(missionId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<MissionRow[]>(
        'DELETE FROM atc_missions WHERE mission_id = ?',
        [missionId],
      )
    } finally {
      conn.release()
    }
  }
}
