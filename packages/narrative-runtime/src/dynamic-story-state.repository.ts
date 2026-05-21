import type { RowDataPacket } from 'mysql2/promise'
import type { NarrativeRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DynamicStoryNotFoundError } from './errors.js'

export type AtcStoryStateType = 'choice' | 'outcome' | 'flag' | 'variable' | 'trigger' | 'custom'

export interface AtcDynamicStoryState {
  id: string
  entityId: string
  branchKey: string
  stateType: AtcStoryStateType
  storyData: Record<string, unknown>
  ownerServerId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface DynamicStoryStateRow extends RowDataPacket {
  id: string
  entity_id: string
  branch_key: string
  state_type: string
  story_data: string
  owner_server_id: string
  is_active: number
  created_at: Date
  updated_at: Date
}

function rowToStoryState(row: DynamicStoryStateRow): AtcDynamicStoryState {
  return {
    id: row.id,
    entityId: row.entity_id,
    branchKey: row.branch_key,
    stateType: row.state_type as AtcStoryStateType,
    storyData: JSON.parse(row.story_data) as Record<string, unknown>,
    ownerServerId: row.owner_server_id,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertStoryStateParams {
  entityId: string
  branchKey: string
  stateType: AtcStoryStateType
  storyData?: Record<string, unknown> | undefined
  ownerServerId: string
}

export class DynamicStoryStateRepository {
  constructor(private readonly pool: NarrativeRuntimePool) {}

  async upsert(params: UpsertStoryStateParams): Promise<AtcDynamicStoryState> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_dynamic_story_state
           (id, entity_id, branch_key, state_type, story_data, owner_server_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           state_type    = VALUES(state_type),
           story_data    = VALUES(story_data),
           owner_server_id = VALUES(owner_server_id),
           is_active     = 1,
           updated_at    = NOW(3)`,
        [
          id,
          params.entityId,
          params.branchKey,
          params.stateType,
          JSON.stringify(params.storyData ?? {}),
          params.ownerServerId,
        ],
      )
      const [rows] = await conn.execute<DynamicStoryStateRow[]>(
        `SELECT * FROM atc_dynamic_story_state
         WHERE entity_id = ? AND branch_key = ?
         LIMIT 1`,
        [params.entityId, params.branchKey],
      )
      if (!rows[0]) throw new DynamicStoryNotFoundError(params.entityId)
      return rowToStoryState(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDynamicStoryState | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DynamicStoryStateRow[]>(
        `SELECT * FROM atc_dynamic_story_state WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToStoryState(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByEntityAndBranch(
    entityId: string,
    branchKey: string,
  ): Promise<AtcDynamicStoryState | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DynamicStoryStateRow[]>(
        `SELECT * FROM atc_dynamic_story_state
         WHERE entity_id = ? AND branch_key = ?
         LIMIT 1`,
        [entityId, branchKey],
      )
      return rows[0] ? rowToStoryState(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByEntity(entityId: string): Promise<AtcDynamicStoryState[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DynamicStoryStateRow[]>(
        `SELECT * FROM atc_dynamic_story_state
         WHERE entity_id = ?
         ORDER BY created_at ASC`,
        [entityId],
      )
      return rows.map(rowToStoryState)
    } finally {
      conn.release()
    }
  }

  async deactivate(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_dynamic_story_state
         SET is_active = 0, updated_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
    } finally {
      conn.release()
    }
  }
}
