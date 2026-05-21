import type { RowDataPacket } from 'mysql2/promise'
import type { NpcRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { CrowdRuntimeNotFoundError } from './errors.js'

export interface AtcCrowdRuntime {
  id: string
  zoneId: string
  density: number
  targetDensity: number
  activeNpcCount: number
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface CrowdRuntimeRow extends RowDataPacket {
  id: string
  zone_id: string
  density: number
  target_density: number
  active_npc_count: number
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToCrowd(row: CrowdRuntimeRow): AtcCrowdRuntime {
  return {
    id: row.id,
    zoneId: row.zone_id,
    density: Number(row.density),
    targetDensity: Number(row.target_density),
    activeNpcCount: Number(row.active_npc_count),
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CrowdRuntimeRepository {
  constructor(private readonly pool: NpcRuntimePool) {}

  async upsert(
    zoneId: string,
    density: number,
    targetDensity: number,
    activeNpcCount: number,
  ): Promise<AtcCrowdRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_crowd_runtime
           (id, zone_id, density, target_density, active_npc_count,
            last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           density          = VALUES(density),
           target_density   = VALUES(target_density),
           active_npc_count = VALUES(active_npc_count),
           last_tick_at     = NOW(3),
           updated_at       = NOW(3)`,
        [id, zoneId, density, targetDensity, activeNpcCount],
      )
      const [rows] = await conn.execute<CrowdRuntimeRow[]>(
        `SELECT * FROM atc_crowd_runtime WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      if (!rows[0]) throw new CrowdRuntimeNotFoundError(zoneId)
      return rowToCrowd(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByZone(zoneId: string): Promise<AtcCrowdRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CrowdRuntimeRow[]>(
        `SELECT * FROM atc_crowd_runtime WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      return rows[0] ? rowToCrowd(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcCrowdRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CrowdRuntimeRow[]>(
        `SELECT * FROM atc_crowd_runtime ORDER BY zone_id ASC`,
      )
      return rows.map(rowToCrowd)
    } finally {
      conn.release()
    }
  }
}
