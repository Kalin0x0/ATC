import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import type { ReputationRuntimePool } from './pool.js'

export type AtcReputationTier =
  | 'hostile'
  | 'unfriendly'
  | 'neutral'
  | 'friendly'
  | 'allied'
  | 'revered'

export interface AtcReputationRuntime {
  id: string
  principalId: string
  factionId: string
  reputationScore: number
  tier: AtcReputationTier
  lastChangeAt: Date
  createdAt: Date
  updatedAt: Date
}

interface ReputationRuntimeRow extends RowDataPacket {
  id: string
  principal_id: string
  faction_id: string
  reputation_score: number
  tier: string
  last_change_at: Date
  created_at: Date
  updated_at: Date
}

export function calculateTier(score: number): AtcReputationTier {
  if (score <= -500) return 'hostile'
  if (score <= -100) return 'unfriendly'
  if (score < 100) return 'neutral'
  if (score < 500) return 'friendly'
  if (score < 900) return 'allied'
  return 'revered'
}

function mapRow(row: ReputationRuntimeRow): AtcReputationRuntime {
  return {
    id: row.id,
    principalId: row.principal_id,
    factionId: row.faction_id,
    reputationScore: Number(row.reputation_score),
    tier: row.tier as AtcReputationTier,
    lastChangeAt: new Date(row.last_change_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export class ReputationRuntimeRepository {
  constructor(private readonly pool: ReputationRuntimePool) {}

  async findByPrincipalAndFaction(
    principalId: string,
    factionId: string,
  ): Promise<AtcReputationRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReputationRuntimeRow[]>(
        'SELECT * FROM atc_reputation_runtime WHERE principal_id = ? AND faction_id = ? LIMIT 1',
        [principalId, factionId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listByPrincipal(principalId: string): Promise<AtcReputationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReputationRuntimeRow[]>(
        'SELECT * FROM atc_reputation_runtime WHERE principal_id = ? ORDER BY created_at ASC',
        [principalId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listByFaction(factionId: string): Promise<AtcReputationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReputationRuntimeRow[]>(
        'SELECT * FROM atc_reputation_runtime WHERE faction_id = ? ORDER BY reputation_score DESC',
        [factionId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async upsert(
    principalId: string,
    factionId: string,
    reputationScore: number,
    tier: AtcReputationTier,
  ): Promise<AtcReputationRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ReputationRuntimeRow[]>(
        `INSERT INTO atc_reputation_runtime
           (id, principal_id, faction_id, reputation_score, tier, last_change_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           reputation_score = ?,
           tier = ?,
           last_change_at = NOW(3),
           updated_at = NOW(3)`,
        [id, principalId, factionId, reputationScore, tier, reputationScore, tier],
      )
      const record = await this.findByPrincipalAndFaction(principalId, factionId)
      return record!
    } finally {
      conn.release()
    }
  }

  async adjustScore(
    principalId: string,
    factionId: string,
    delta: number,
  ): Promise<AtcReputationRuntime> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<ReputationRuntimeRow[]>(
        'SELECT * FROM atc_reputation_runtime WHERE principal_id = ? AND faction_id = ? LIMIT 1 FOR UPDATE',
        [principalId, factionId],
      )

      let newScore: number
      const existingRow = rows[0]
      if (existingRow !== undefined) {
        const current = Number(existingRow.reputation_score)
        newScore = Math.max(-1000, Math.min(1000, current + delta))
      } else {
        newScore = Math.max(-1000, Math.min(1000, delta))
      }

      const newTier = calculateTier(newScore)

      if (rows.length > 0) {
        await conn.execute<ReputationRuntimeRow[]>(
          `UPDATE atc_reputation_runtime
           SET reputation_score = ?, tier = ?, last_change_at = NOW(3), updated_at = NOW(3)
           WHERE principal_id = ? AND faction_id = ?`,
          [newScore, newTier, principalId, factionId],
        )
      } else {
        const id = generateId()
        await conn.execute<ReputationRuntimeRow[]>(
          `INSERT INTO atc_reputation_runtime
             (id, principal_id, faction_id, reputation_score, tier, last_change_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
          [id, principalId, factionId, newScore, newTier],
        )
      }

      await conn.commit()
      committed = true

      const updated = await this.findByPrincipalAndFaction(principalId, factionId)
      return updated!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listAboveThreshold(
    factionId: string,
    minScore: number,
  ): Promise<AtcReputationRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReputationRuntimeRow[]>(
        'SELECT * FROM atc_reputation_runtime WHERE faction_id = ? AND reputation_score >= ? ORDER BY reputation_score DESC',
        [factionId, minScore],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteByPrincipal(principalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ReputationRuntimeRow[]>(
        'DELETE FROM atc_reputation_runtime WHERE principal_id = ?',
        [principalId],
      )
    } finally {
      conn.release()
    }
  }
}
