import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EcologyRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcWildlifeType =
  | 'predator'
  | 'prey'
  | 'scavenger'
  | 'herbivore'
  | 'marine'
  | 'custom'

export type AtcWildlifeStatus =
  | 'thriving'
  | 'stable'
  | 'declining'
  | 'endangered'
  | 'extinct'

export interface AtcWildlifeRuntime {
  id: string
  zoneId: string
  wildlifeType: AtcWildlifeType
  status: AtcWildlifeStatus
  ownerServerId: string
  population: number
  wildlifeData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface WildlifeRuntimeRow extends RowDataPacket {
  id: string
  zone_id: string
  wildlife_type: string
  status: string
  owner_server_id: string
  population: number
  wildlife_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: WildlifeRuntimeRow): AtcWildlifeRuntime {
  let wildlifeData: Record<string, unknown> = {}
  try {
    const parsed: unknown = typeof row.wildlife_data === 'string'
      ? JSON.parse(row.wildlife_data)
      : row.wildlife_data
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      wildlifeData = parsed as Record<string, unknown>
    }
  } catch {
    wildlifeData = {}
  }
  return {
    id: row.id,
    zoneId: row.zone_id,
    wildlifeType: row.wildlife_type as AtcWildlifeType,
    status: row.status as AtcWildlifeStatus,
    ownerServerId: row.owner_server_id,
    population: Number(row.population),
    wildlifeData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertWildlifeParams {
  zoneId: string
  wildlifeType: AtcWildlifeType
  status: AtcWildlifeStatus
  ownerServerId: string
  population: number
  wildlifeData?: Record<string, unknown>
}

export class WildlifeRuntimeRepository {
  constructor(private readonly pool: EcologyRuntimePool) {}

  async upsert(params: UpsertWildlifeParams): Promise<AtcWildlifeRuntime> {
    const id = generateId()
    const wildlifeData = JSON.stringify(params.wildlifeData ?? {})
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_wildlife_runtime
           (id, zone_id, wildlife_type, status, owner_server_id,
            population, wildlife_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           wildlife_type   = VALUES(wildlife_type),
           status          = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           population      = VALUES(population),
           wildlife_data   = VALUES(wildlife_data),
           updated_at      = NOW(3)`,
        [
          id,
          params.zoneId,
          params.wildlifeType,
          params.status,
          params.ownerServerId,
          params.population,
          wildlifeData,
        ],
      )
      const [rows] = await conn.execute<WildlifeRuntimeRow[]>(
        `SELECT * FROM atc_wildlife_runtime WHERE zone_id = ? LIMIT 1`,
        [params.zoneId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Wildlife runtime not found after upsert for zone: ${params.zoneId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByZone(zoneId: string): Promise<AtcWildlifeRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WildlifeRuntimeRow[]>(
        `SELECT * FROM atc_wildlife_runtime WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      const row = rows[0]
      return row ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async cleanupExtinct(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_wildlife_runtime
         WHERE status = 'extinct'
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
