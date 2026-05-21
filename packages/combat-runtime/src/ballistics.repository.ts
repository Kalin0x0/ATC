import type { RowDataPacket } from 'mysql2/promise'
import type { AtcBallisticsRecord } from '@atc/shared-types'
import type { CombatPool } from './pool.js'
import { generateId } from './id.js'

interface BallisticsRow extends RowDataPacket {
  id: string
  damage_event_id: string
  velocity: number | null
  distance: number | null
  impact_angle: number | null
  penetration_data: string | null
  created_at: Date
}

function rowToBallistics(row: BallisticsRow): AtcBallisticsRecord {
  return {
    id: row.id,
    damageEventId: row.damage_event_id,
    velocity: row.velocity,
    distance: row.distance,
    impactAngle: row.impact_angle,
    penetrationData: row.penetration_data,
    createdAt: row.created_at,
  }
}

export interface RecordBallisticsParams {
  damageEventId: string
  velocity?: number | undefined
  distance?: number | undefined
  impactAngle?: number | undefined
  penetrationData?: string | undefined
}

export class BallisticsRepository {
  constructor(private readonly pool: CombatPool) {}

  async record(params: RecordBallisticsParams): Promise<AtcBallisticsRecord> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_ballistics
           (id, damage_event_id, velocity, distance, impact_angle, penetration_data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.damageEventId,
          params.velocity ?? null,
          params.distance ?? null,
          params.impactAngle ?? null,
          params.penetrationData ?? null,
        ],
      )
      const [rows] = await conn.execute<BallisticsRow[]>(
        `SELECT * FROM atc_ballistics WHERE id = ? LIMIT 1`,
        [id],
      )
      return rowToBallistics(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findByDamageEvent(damageEventId: string): Promise<AtcBallisticsRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BallisticsRow[]>(
        `SELECT * FROM atc_ballistics WHERE damage_event_id = ? LIMIT 1`,
        [damageEventId],
      )
      return rows[0] ? rowToBallistics(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
