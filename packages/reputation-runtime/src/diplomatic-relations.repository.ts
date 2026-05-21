import type { RowDataPacket } from 'mysql2/promise'
import { DiplomaticRelationNotFoundError } from './errors.js'
import { generateId } from './id.js'
import type { ReputationRuntimePool } from './pool.js'

export type AtcDiplomaticStatus =
  | 'war'
  | 'hostile'
  | 'neutral'
  | 'friendly'
  | 'allied'
  | 'vassal'

export interface AtcDiplomaticRelation {
  id: string
  factionAId: string
  factionBId: string
  relationStatus: AtcDiplomaticStatus
  relationScore: number
  lastUpdatedAt: Date
  createdAt: Date
  updatedAt: Date
}

interface DiplomaticRelationRow extends RowDataPacket {
  id: string
  faction_a_id: string
  faction_b_id: string
  relation_status: string
  relation_score: number
  last_updated_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: DiplomaticRelationRow): AtcDiplomaticRelation {
  return {
    id: row.id,
    factionAId: row.faction_a_id,
    factionBId: row.faction_b_id,
    relationStatus: row.relation_status as AtcDiplomaticStatus,
    relationScore: Number(row.relation_score),
    lastUpdatedAt: new Date(row.last_updated_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export class DiplomaticRelationsRepository {
  constructor(private readonly pool: ReputationRuntimePool) {}

  async find(
    factionAId: string,
    factionBId: string,
  ): Promise<AtcDiplomaticRelation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DiplomaticRelationRow[]>(
        `SELECT * FROM atc_diplomatic_relations
         WHERE (faction_a_id = ? AND faction_b_id = ?)
            OR (faction_a_id = ? AND faction_b_id = ?)
         LIMIT 1`,
        [factionAId, factionBId, factionBId, factionAId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listByFaction(factionId: string): Promise<AtcDiplomaticRelation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DiplomaticRelationRow[]>(
        `SELECT * FROM atc_diplomatic_relations
         WHERE faction_a_id = ? OR faction_b_id = ?
         ORDER BY created_at ASC`,
        [factionId, factionId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async upsert(
    factionAId: string,
    factionBId: string,
    status: AtcDiplomaticStatus,
    score: number,
  ): Promise<AtcDiplomaticRelation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<DiplomaticRelationRow[]>(
        `INSERT INTO atc_diplomatic_relations
           (id, faction_a_id, faction_b_id, relation_status, relation_score, last_updated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           relation_status = ?,
           relation_score = ?,
           last_updated_at = NOW(3),
           updated_at = NOW(3)`,
        [id, factionAId, factionBId, status, score, status, score],
      )
      const record = await this.find(factionAId, factionBId)
      return record!
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    factionAId: string,
    factionBId: string,
    status: AtcDiplomaticStatus,
    score: number,
  ): Promise<AtcDiplomaticRelation> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<DiplomaticRelationRow[]>(
        `SELECT * FROM atc_diplomatic_relations
         WHERE (faction_a_id = ? AND faction_b_id = ?)
            OR (faction_a_id = ? AND faction_b_id = ?)
         LIMIT 1 FOR UPDATE`,
        [factionAId, factionBId, factionBId, factionAId],
      )

      const existing = rows[0]
      if (existing === undefined) {
        throw new DiplomaticRelationNotFoundError(factionAId, factionBId)
      }

      await conn.execute<DiplomaticRelationRow[]>(
        `UPDATE atc_diplomatic_relations
         SET relation_status = ?, relation_score = ?, last_updated_at = NOW(3), updated_at = NOW(3)
         WHERE id = ?`,
        [status, score, existing.id],
      )

      await conn.commit()
      committed = true

      const updated = await this.find(factionAId, factionBId)
      return updated!
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async delete(factionAId: string, factionBId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<DiplomaticRelationRow[]>(
        `DELETE FROM atc_diplomatic_relations
         WHERE (faction_a_id = ? AND faction_b_id = ?)
            OR (faction_a_id = ? AND faction_b_id = ?)`,
        [factionAId, factionBId, factionBId, factionAId],
      )
    } finally {
      conn.release()
    }
  }
}
