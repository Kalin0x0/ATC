import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GovernanceRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcInfluenceType = 'political' | 'economic' | 'social' | 'military' | 'custom'

export interface AtcCivicInfluence {
  id: string
  entityId: string
  influenceType: AtcInfluenceType
  influenceScore: number
  ownerServerId: string
  regionId: string | null
  influenceData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface CivicInfluenceRow extends RowDataPacket {
  id: string
  entity_id: string
  influence_type: string
  influence_score: string
  owner_server_id: string
  region_id: string | null
  influence_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: CivicInfluenceRow): AtcCivicInfluence {
  let influenceData: Record<string, unknown> = {}
  try {
    influenceData = JSON.parse(row.influence_data) as Record<string, unknown>
  } catch {
    influenceData = {}
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    influenceType: row.influence_type as AtcInfluenceType,
    influenceScore: parseFloat(row.influence_score),
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    influenceData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertCivicInfluenceParams {
  entityId: string
  influenceType: AtcInfluenceType
  influenceScore: number
  ownerServerId: string
  regionId?: string | null | undefined
  influenceData?: Record<string, unknown> | undefined
}

export class CivicInfluenceRepository {
  constructor(private readonly pool: GovernanceRuntimePool) {}

  async upsert(params: UpsertCivicInfluenceParams): Promise<AtcCivicInfluence> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const influenceDataJson = JSON.stringify(params.influenceData ?? {})
      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_civic_influence
           (id, entity_id, influence_type, influence_score, owner_server_id, region_id,
            influence_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           influence_type = VALUES(influence_type),
           influence_score = VALUES(influence_score),
           owner_server_id = VALUES(owner_server_id),
           region_id = VALUES(region_id),
           influence_data = VALUES(influence_data),
           updated_at = NOW(3)`,
        [
          id,
          params.entityId,
          params.influenceType,
          params.influenceScore,
          params.ownerServerId,
          params.regionId ?? null,
          influenceDataJson,
        ],
      )
      const [rows] = await conn.execute<CivicInfluenceRow[]>(
        `SELECT id, entity_id, influence_type, influence_score, owner_server_id, region_id,
                influence_data, created_at, updated_at
         FROM atc_civic_influence
         WHERE entity_id = ?
         LIMIT 1`,
        [params.entityId],
      )
      if (!rows[0]) throw new Error(`Civic influence not found after upsert for entity: ${params.entityId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcCivicInfluence | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CivicInfluenceRow[]>(
        `SELECT id, entity_id, influence_type, influence_score, owner_server_id, region_id,
                influence_data, created_at, updated_at
         FROM atc_civic_influence
         WHERE entity_id = ?
         LIMIT 1`,
        [entityId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async cleanupInactive(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdDate = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_civic_influence
         WHERE updated_at < ?`,
        [thresholdDate],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
