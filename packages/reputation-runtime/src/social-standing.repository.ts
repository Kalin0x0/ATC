import type { RowDataPacket } from 'mysql2/promise'
import { SocialStandingNotFoundError } from './errors.js'
import { generateId } from './id.js'
import type { ReputationRuntimePool } from './pool.js'

export type AtcStandingTier =
  | 'criminal'
  | 'disreputable'
  | 'common'
  | 'respected'
  | 'prominent'
  | 'elite'

export interface AtcSocialStanding {
  id: string
  principalId: string
  standingScore: number
  standingTier: AtcStandingTier
  lastChangeAt: Date
  createdAt: Date
  updatedAt: Date
}

interface SocialStandingRow extends RowDataPacket {
  id: string
  principal_id: string
  standing_score: number
  standing_tier: string
  last_change_at: Date
  created_at: Date
  updated_at: Date
}

export function calculateStandingTier(score: number): AtcStandingTier {
  if (score < 50) return 'criminal'
  if (score < 200) return 'disreputable'
  if (score < 400) return 'common'
  if (score < 600) return 'respected'
  if (score < 850) return 'prominent'
  return 'elite'
}

function mapRow(row: SocialStandingRow): AtcSocialStanding {
  return {
    id: row.id,
    principalId: row.principal_id,
    standingScore: Number(row.standing_score),
    standingTier: row.standing_tier as AtcStandingTier,
    lastChangeAt: new Date(row.last_change_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export class SocialStandingRepository {
  constructor(private readonly pool: ReputationRuntimePool) {}

  async findByPrincipal(principalId: string): Promise<AtcSocialStanding | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SocialStandingRow[]>(
        'SELECT * FROM atc_social_standing WHERE principal_id = ? LIMIT 1',
        [principalId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async upsert(
    principalId: string,
    score: number,
    tier: AtcStandingTier,
  ): Promise<AtcSocialStanding> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<SocialStandingRow[]>(
        `INSERT INTO atc_social_standing
           (id, principal_id, standing_score, standing_tier, last_change_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           standing_score = ?,
           standing_tier = ?,
           last_change_at = NOW(3),
           updated_at = NOW(3)`,
        [id, principalId, score, tier, score, tier],
      )
      const record = await this.findByPrincipal(principalId)
      return record!
    } finally {
      conn.release()
    }
  }

  async adjust(principalId: string, delta: number): Promise<AtcSocialStanding> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<SocialStandingRow[]>(
        'SELECT * FROM atc_social_standing WHERE principal_id = ? LIMIT 1 FOR UPDATE',
        [principalId],
      )

      const existingRow = rows[0]
      if (existingRow === undefined) {
        throw new SocialStandingNotFoundError(principalId)
      }

      const current = Number(existingRow.standing_score)
      const newScore = Math.max(0, Math.min(1000, current + delta))
      const newTier = calculateStandingTier(newScore)

      await conn.execute<SocialStandingRow[]>(
        `UPDATE atc_social_standing
         SET standing_score = ?, standing_tier = ?, last_change_at = NOW(3), updated_at = NOW(3)
         WHERE principal_id = ?`,
        [newScore, newTier, principalId],
      )

      await conn.commit()
      committed = true

      const updated = await this.findByPrincipal(principalId)
      return updated!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listAboveThreshold(minScore: number): Promise<AtcSocialStanding[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SocialStandingRow[]>(
        'SELECT * FROM atc_social_standing WHERE standing_score >= ? ORDER BY standing_score DESC',
        [minScore],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteByPrincipal(principalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<SocialStandingRow[]>(
        'DELETE FROM atc_social_standing WHERE principal_id = ?',
        [principalId],
      )
    } finally {
      conn.release()
    }
  }
}
