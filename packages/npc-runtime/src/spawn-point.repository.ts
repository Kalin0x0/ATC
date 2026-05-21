import type { RowDataPacket } from 'mysql2/promise'
import type { NpcRuntimePool } from './pool.js'
import { SpawnPointNotFoundError } from './errors.js'

export interface AtcNpcSpawnPoint {
  id: string
  zoneId: string
  positionX: number
  positionY: number
  positionZ: number
  heading: number
  spawnType: string
  isEnabled: boolean
  lastUsedAt: Date | null
  createdAt: Date
}

interface SpawnPointRow extends RowDataPacket {
  id: string
  zone_id: string
  position_x: number
  position_y: number
  position_z: number
  heading: number
  spawn_type: string
  is_enabled: number
  last_used_at: Date | null
  created_at: Date
}

function rowToSpawnPoint(row: SpawnPointRow): AtcNpcSpawnPoint {
  return {
    id: row.id,
    zoneId: row.zone_id,
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    positionZ: Number(row.position_z),
    heading: Number(row.heading),
    spawnType: row.spawn_type,
    isEnabled: Boolean(row.is_enabled),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  }
}

export class NpcSpawnPointRepository {
  constructor(private readonly pool: NpcRuntimePool) {}

  async findById(id: string): Promise<AtcNpcSpawnPoint | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpawnPointRow[]>(
        `SELECT * FROM atc_npc_spawn_points WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToSpawnPoint(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByZone(zoneId: string): Promise<AtcNpcSpawnPoint[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpawnPointRow[]>(
        `SELECT * FROM atc_npc_spawn_points
         WHERE zone_id = ?
         ORDER BY created_at ASC`,
        [zoneId],
      )
      return rows.map(rowToSpawnPoint)
    } finally {
      conn.release()
    }
  }

  async listEnabled(zoneId?: string | undefined): Promise<AtcNpcSpawnPoint[]> {
    const conn = await this.pool.getConnection()
    try {
      if (zoneId !== undefined) {
        const [rows] = await conn.execute<SpawnPointRow[]>(
          `SELECT * FROM atc_npc_spawn_points
           WHERE zone_id = ? AND is_enabled = 1
           ORDER BY created_at ASC`,
          [zoneId],
        )
        return rows.map(rowToSpawnPoint)
      }
      const [rows] = await conn.execute<SpawnPointRow[]>(
        `SELECT * FROM atc_npc_spawn_points
         WHERE is_enabled = 1
         ORDER BY zone_id ASC, created_at ASC`,
      )
      return rows.map(rowToSpawnPoint)
    } finally {
      conn.release()
    }
  }

  async markUsed(id: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SpawnPointRow[]>(
        `SELECT id FROM atc_npc_spawn_points WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new SpawnPointNotFoundError(id)

      await conn.execute(
        `UPDATE atc_npc_spawn_points SET last_used_at = NOW(3) WHERE id = ?`,
        [id],
      )
    } finally {
      conn.release()
    }
  }
}
