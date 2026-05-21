import type { RowDataPacket } from 'mysql2/promise'
import type { NarrativeRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { StoryProgressionNotFoundError } from './errors.js'

export type AtcProgressionType = 'linear' | 'branching' | 'open' | 'gated' | 'custom'

export interface AtcStoryProgression {
  id: string
  entityId: string
  campaignId: string | null
  progressionType: AtcProgressionType
  stageKey: string
  progressionData: Record<string, unknown>
  ownerServerId: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface StoryProgressionRow extends RowDataPacket {
  id: string
  entity_id: string
  campaign_id: string | null
  progression_type: string
  stage_key: string
  progression_data: string
  owner_server_id: string
  is_active: number
  created_at: Date
  updated_at: Date
}

function rowToProgression(row: StoryProgressionRow): AtcStoryProgression {
  return {
    id: row.id,
    entityId: row.entity_id,
    campaignId: row.campaign_id,
    progressionType: row.progression_type as AtcProgressionType,
    stageKey: row.stage_key,
    progressionData: JSON.parse(row.progression_data) as Record<string, unknown>,
    ownerServerId: row.owner_server_id,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateProgressionParams {
  entityId: string
  campaignId?: string | null | undefined
  progressionType: AtcProgressionType
  stageKey: string
  progressionData?: Record<string, unknown> | undefined
  ownerServerId: string
}

export class StoryProgressionRepository {
  constructor(private readonly pool: NarrativeRuntimePool) {}

  async create(params: CreateProgressionParams): Promise<AtcStoryProgression> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_story_progression
           (id, entity_id, campaign_id, progression_type, stage_key,
            progression_data, owner_server_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(3), NOW(3))`,
        [
          id,
          params.entityId,
          params.campaignId ?? null,
          params.progressionType,
          params.stageKey,
          JSON.stringify(params.progressionData ?? {}),
          params.ownerServerId,
        ],
      )
      const [rows] = await conn.execute<StoryProgressionRow[]>(
        `SELECT * FROM atc_story_progression WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new StoryProgressionNotFoundError(id)
      return rowToProgression(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcStoryProgression | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StoryProgressionRow[]>(
        `SELECT * FROM atc_story_progression WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToProgression(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByEntityAndCampaign(
    entityId: string,
    campaignId: string,
  ): Promise<AtcStoryProgression[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StoryProgressionRow[]>(
        `SELECT * FROM atc_story_progression
         WHERE entity_id = ? AND campaign_id = ?
         ORDER BY created_at ASC`,
        [entityId, campaignId],
      )
      return rows.map(rowToProgression)
    } finally {
      conn.release()
    }
  }

  async advanceStage(
    id: string,
    newStageKey: string,
    progressionData?: Record<string, unknown> | undefined,
  ): Promise<AtcStoryProgression> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<StoryProgressionRow[]>(
          `SELECT * FROM atc_story_progression WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new StoryProgressionNotFoundError(id)
        await conn.execute(
          `UPDATE atc_story_progression
           SET stage_key = ?,
               progression_data = COALESCE(?, progression_data),
               updated_at = NOW(3)
           WHERE id = ?`,
          [newStageKey, progressionData !== undefined ? JSON.stringify(progressionData) : null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<StoryProgressionRow[]>(
        `SELECT * FROM atc_story_progression WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new StoryProgressionNotFoundError(id)
      return rowToProgression(rows[0])
    } finally {
      conn.release()
    }
  }

  async deactivate(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_story_progression
         SET is_active = 0, updated_at = NOW(3)
         WHERE id = ?`,
        [id],
      )
    } finally {
      conn.release()
    }
  }
}
