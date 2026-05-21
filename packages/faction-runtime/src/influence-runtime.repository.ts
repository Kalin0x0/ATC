import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FactionPool } from './pool.js'
import { generateId } from './id.js'

export interface AtcInfluenceRecord {
  id: string
  factionId: string
  territoryId: string
  influenceScore: number
  influenceDelta: number
  lastTickAt: Date
  decayRate: number
  createdAt: Date
  updatedAt: Date
}

interface InfluenceRow extends RowDataPacket {
  id: string
  faction_id: string
  territory_id: string
  influence_score: string
  influence_delta: string
  last_tick_at: Date
  decay_rate: string
  created_at: Date
  updated_at: Date
}

function rowToInfluence(row: InfluenceRow): AtcInfluenceRecord {
  return {
    id: row.id,
    factionId: row.faction_id,
    territoryId: row.territory_id,
    influenceScore: Number(row.influence_score),
    influenceDelta: Number(row.influence_delta),
    lastTickAt: row.last_tick_at,
    decayRate: Number(row.decay_rate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class InfluenceRuntimeRepository {
  constructor(private readonly pool: FactionPool) {}

  async upsert(factionId: string, territoryId: string, score: number): Promise<AtcInfluenceRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const clamped = Math.max(0, Math.min(100, score))
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_influence_runtime
           (id, faction_id, territory_id, influence_score, influence_delta, last_tick_at, decay_rate, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0.00, NOW(3), 0.0100, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           influence_score = ?,
           last_tick_at = NOW(3),
           updated_at = NOW(3)`,
        [id, factionId, territoryId, clamped, clamped],
      )
      const [rows] = await conn.execute<InfluenceRow[]>(
        'SELECT * FROM atc_influence_runtime WHERE faction_id = ? AND territory_id = ? LIMIT 1',
        [factionId, territoryId],
      )
      return rowToInfluence(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByFactionAndTerritory(factionId: string, territoryId: string): Promise<AtcInfluenceRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfluenceRow[]>(
        'SELECT * FROM atc_influence_runtime WHERE faction_id = ? AND territory_id = ? LIMIT 1',
        [factionId, territoryId],
      )
      return rows[0] ? rowToInfluence(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByTerritory(territoryId: string): Promise<AtcInfluenceRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfluenceRow[]>(
        'SELECT * FROM atc_influence_runtime WHERE territory_id = ? ORDER BY influence_score DESC',
        [territoryId],
      )
      return rows.map(rowToInfluence)
    } finally {
      conn.release()
    }
  }

  async listByFaction(factionId: string): Promise<AtcInfluenceRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfluenceRow[]>(
        'SELECT * FROM atc_influence_runtime WHERE faction_id = ? ORDER BY influence_score DESC',
        [factionId],
      )
      return rows.map(rowToInfluence)
    } finally {
      conn.release()
    }
  }

  async applyDecay(territoryId: string, decayAmount: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_influence_runtime
         SET influence_score = GREATEST(0, influence_score - ?),
             influence_delta = -?,
             last_tick_at = NOW(3),
             updated_at = NOW(3)
         WHERE territory_id = ?`,
        [decayAmount, decayAmount, territoryId],
      )
    } finally {
      conn.release()
    }
  }

  async addInfluence(factionId: string, territoryId: string, amount: number): Promise<AtcInfluenceRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_influence_runtime
           (id, faction_id, territory_id, influence_score, influence_delta, last_tick_at, decay_rate, created_at, updated_at)
         VALUES (?, ?, ?, LEAST(100, ?), ?, NOW(3), 0.0100, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           influence_score = LEAST(100, influence_score + ?),
           influence_delta = ?,
           last_tick_at = NOW(3),
           updated_at = NOW(3)`,
        [id, factionId, territoryId, amount, amount, amount, amount],
      )
      const [rows] = await conn.execute<InfluenceRow[]>(
        'SELECT * FROM atc_influence_runtime WHERE faction_id = ? AND territory_id = ? LIMIT 1',
        [factionId, territoryId],
      )
      return rowToInfluence(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async getTopFaction(territoryId: string): Promise<AtcInfluenceRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfluenceRow[]>(
        'SELECT * FROM atc_influence_runtime WHERE territory_id = ? ORDER BY influence_score DESC LIMIT 1',
        [territoryId],
      )
      return rows[0] ? rowToInfluence(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
