import type { RowDataPacket } from 'mysql2/promise'
import type { MissionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ScenarioNotFoundError } from './errors.js'

export type AtcScenarioType =
  | 'combat'
  | 'rescue'
  | 'transport'
  | 'investigation'
  | 'escort'
  | 'custom'

export type AtcScenarioStatus = 'spawning' | 'active' | 'completed' | 'failed' | 'cleanup'

export interface AtcScenarioRuntime {
  id: string
  scenarioId: string
  scenarioType: AtcScenarioType
  status: AtcScenarioStatus
  missionId: string | null
  configData: Record<string, unknown>
  lastTickAt: Date
  ownerServerId: string | null
  createdAt: Date
  updatedAt: Date
}

interface ScenarioRow extends RowDataPacket {
  id: string
  scenario_id: string
  scenario_type: string
  status: string
  mission_id: string | null
  config_data: string | null
  last_tick_at: Date
  owner_server_id: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ScenarioRow): AtcScenarioRuntime {
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
    scenarioId: row.scenario_id,
    scenarioType: row.scenario_type as AtcScenarioType,
    status: row.status as AtcScenarioStatus,
    missionId: row.mission_id,
    configData,
    lastTickAt: row.last_tick_at,
    ownerServerId: row.owner_server_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertScenarioParams {
  scenarioId: string
  scenarioType: AtcScenarioType
  status?: AtcScenarioStatus
  missionId?: string
  configData?: Record<string, unknown>
  ownerServerId?: string
}

export class ScenarioRuntimeRepository {
  constructor(private readonly pool: MissionRuntimePool) {}

  async findById(scenarioId: string): Promise<AtcScenarioRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ScenarioRow[]>(
        'SELECT * FROM atc_scenario_runtime WHERE scenario_id = ? LIMIT 1',
        [scenarioId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcScenarioRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ScenarioRow[]>(
        "SELECT * FROM atc_scenario_runtime WHERE status IN ('spawning', 'active') ORDER BY created_at ASC",
        [],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertScenarioParams): Promise<AtcScenarioRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const configData = JSON.stringify(params.configData ?? {})
      const binds: (string | number | boolean | null)[] = [
        id,
        params.scenarioId,
        params.scenarioType,
        params.status ?? 'active',
        params.missionId ?? null,
        configData,
        params.ownerServerId ?? null,
      ]
      await conn.execute<ScenarioRow[]>(
        `INSERT INTO atc_scenario_runtime
         (id, scenario_id, scenario_type, status, mission_id, config_data, last_tick_at, owner_server_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           last_tick_at = NOW(3),
           config_data = VALUES(config_data),
           updated_at = NOW(3)`,
        binds,
      )
      const scenario = await this.findById(params.scenarioId)
      if (!scenario) throw new ScenarioNotFoundError(params.scenarioId)
      return scenario
    } finally {
      conn.release()
    }
  }

  async transition(scenarioId: string, status: AtcScenarioStatus): Promise<AtcScenarioRuntime> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<ScenarioRow[]>(
        'SELECT * FROM atc_scenario_runtime WHERE scenario_id = ? FOR UPDATE',
        [scenarioId],
      )
      if (rows.length === 0) throw new ScenarioNotFoundError(scenarioId)

      await conn.execute<ScenarioRow[]>(
        'UPDATE atc_scenario_runtime SET status = ?, updated_at = NOW(3) WHERE scenario_id = ?',
        [status, scenarioId],
      )

      await conn.commit()
      committed = true

      const scenario = await this.findById(scenarioId)
      if (!scenario) throw new ScenarioNotFoundError(scenarioId)
      return scenario
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcScenarioRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdSec = thresholdMs / 1000
      const binds: (string | number | boolean | null)[] = [thresholdSec]
      const [rows] = await conn.execute<ScenarioRow[]>(
        `SELECT * FROM atc_scenario_runtime
         WHERE last_tick_at < DATE_SUB(NOW(3), INTERVAL ? SECOND)`,
        binds,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteById(scenarioId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ScenarioRow[]>(
        'DELETE FROM atc_scenario_runtime WHERE scenario_id = ?',
        [scenarioId],
      )
    } finally {
      conn.release()
    }
  }
}
