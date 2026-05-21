import type { RowDataPacket } from 'mysql2/promise'
import type { WorldOrchestratorPool } from './pool.js'
import { generateId } from './id.js'

export type AtcBalancingTrigger = 'manual' | 'threshold' | 'recovery' | 'scheduled' | 'custom'

export interface AtcWorldBalancing {
  id: string
  balancingId: string
  regionId: string | null
  triggerType: AtcBalancingTrigger
  shardsBefore: number
  shardsAfter: number
  loadBefore: number
  loadAfter: number
  balancingData: Record<string, unknown>
  completedAt: Date
  createdAt: Date
}

export interface RecordBalancingParams {
  regionId?: string | undefined
  triggerType: AtcBalancingTrigger
  shardsBefore: number
  shardsAfter: number
  loadBefore: number
  loadAfter: number
  balancingData?: Record<string, unknown> | undefined
}

interface AtcWorldBalancingRow extends RowDataPacket {
  id: string
  balancing_id: string
  region_id: string | null
  trigger_type: string
  shards_before: number
  shards_after: number
  load_before: number
  load_after: number
  balancing_data: string
  completed_at: Date
  created_at: Date
}

function mapRow(row: AtcWorldBalancingRow): AtcWorldBalancing {
  return {
    id: row.id,
    balancingId: row.balancing_id,
    regionId: row.region_id,
    triggerType: row.trigger_type as AtcBalancingTrigger,
    shardsBefore: row.shards_before,
    shardsAfter: row.shards_after,
    loadBefore: row.load_before,
    loadAfter: row.load_after,
    balancingData: JSON.parse(row.balancing_data) as Record<string, unknown>,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

export class WorldBalancingRepository {
  constructor(private readonly pool: WorldOrchestratorPool) {}

  async record(params: RecordBalancingParams): Promise<AtcWorldBalancing> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const balancingId = generateId()
      const balancingData = JSON.stringify(params.balancingData ?? {})

      await conn.execute(
        `INSERT INTO atc_world_balancing
           (id, balancing_id, region_id, trigger_type, shards_before, shards_after,
            load_before, load_after, balancing_data, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          id,
          balancingId,
          params.regionId ?? null,
          params.triggerType,
          params.shardsBefore,
          params.shardsAfter,
          params.loadBefore,
          params.loadAfter,
          balancingData,
        ],
      )

      const result = await this.findByBalancingId(balancingId)
      if (!result) throw new Error(`Failed to retrieve balancing record: ${balancingId}`)
      return result
    } finally {
      conn.release()
    }
  }

  private async findByBalancingId(balancingId: string): Promise<AtcWorldBalancing | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcWorldBalancingRow[]>(
        `SELECT id, balancing_id, region_id, trigger_type, shards_before, shards_after,
                load_before, load_after, balancing_data, completed_at, created_at
         FROM atc_world_balancing
         WHERE balancing_id = ?
         LIMIT 1`,
        [balancingId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async getLatest(): Promise<AtcWorldBalancing | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcWorldBalancingRow[]>(
        `SELECT id, balancing_id, region_id, trigger_type, shards_before, shards_after,
                load_before, load_after, balancing_data, completed_at, created_at
         FROM atc_world_balancing
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByRegion(regionId: string): Promise<AtcWorldBalancing[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcWorldBalancingRow[]>(
        `SELECT id, balancing_id, region_id, trigger_type, shards_before, shards_after,
                load_before, load_after, balancing_data, completed_at, created_at
         FROM atc_world_balancing
         WHERE region_id = ?
         ORDER BY created_at DESC`,
        [regionId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
