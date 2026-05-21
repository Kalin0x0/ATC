import type { RowDataPacket } from 'mysql2/promise'
import type { DisasterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { HazardZoneNotFoundError } from './errors.js'

export type AtcHazardType =
  | 'radiation'
  | 'chemical'
  | 'biological'
  | 'fire'
  | 'flood'
  | 'structural'
  | 'exclusion'

export type AtcHazardZoneStatus = 'active' | 'clearing' | 'cleared' | 'contained'

export interface AtcHazardZone {
  id: string
  zoneId: string
  disasterId: string | null
  hazardType: AtcHazardType
  severity: number
  status: AtcHazardZoneStatus
  propagationRadius: number | null
  createdAt: Date
  updatedAt: Date
}

interface HazardZoneRow extends RowDataPacket {
  id: string
  zone_id: string
  disaster_id: string | null
  hazard_type: string
  severity: number
  status: string
  propagation_radius: number | null
  created_at: Date
  updated_at: Date
}

function rowToHazardZone(row: HazardZoneRow): AtcHazardZone {
  return {
    id: row.id,
    zoneId: row.zone_id,
    disasterId: row.disaster_id,
    hazardType: row.hazard_type as AtcHazardType,
    severity: Number(row.severity),
    status: row.status as AtcHazardZoneStatus,
    propagationRadius: row.propagation_radius !== null ? Number(row.propagation_radius) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertHazardZoneParams {
  zoneId: string
  disasterId?: string | undefined
  hazardType: AtcHazardType
  severity: number
  propagationRadius?: number | undefined
}

export class HazardZoneRepository {
  constructor(private readonly pool: DisasterRuntimePool) {}

  async findById(zoneId: string): Promise<AtcHazardZone | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HazardZoneRow[]>(
        `SELECT * FROM atc_hazard_zones WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      return rows[0] ? rowToHazardZone(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByDisaster(disasterId: string): Promise<AtcHazardZone[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HazardZoneRow[]>(
        `SELECT * FROM atc_hazard_zones WHERE disaster_id = ? ORDER BY created_at DESC`,
        [disasterId],
      )
      return rows.map(rowToHazardZone)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcHazardZone[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HazardZoneRow[]>(
        `SELECT * FROM atc_hazard_zones
         WHERE status IN ('active', 'clearing')
         ORDER BY created_at DESC`,
      )
      return rows.map(rowToHazardZone)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertHazardZoneParams): Promise<AtcHazardZone> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_hazard_zones
           (id, zone_id, disaster_id, hazard_type, severity, status, propagation_radius,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           hazard_type        = VALUES(hazard_type),
           severity           = VALUES(severity),
           propagation_radius = VALUES(propagation_radius),
           updated_at         = NOW(3)`,
        [
          id,
          params.zoneId,
          params.disasterId ?? null,
          params.hazardType,
          params.severity,
          params.propagationRadius ?? null,
        ] as (string | number | boolean | null)[],
      )
      const [rows] = await conn.execute<HazardZoneRow[]>(
        `SELECT * FROM atc_hazard_zones WHERE zone_id = ? LIMIT 1`,
        [params.zoneId],
      )
      if (!rows[0]) throw new HazardZoneNotFoundError(params.zoneId)
      return rowToHazardZone(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(zoneId: string, status: AtcHazardZoneStatus): Promise<AtcHazardZone> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<HazardZoneRow[]>(
          `SELECT * FROM atc_hazard_zones WHERE zone_id = ? LIMIT 1 FOR UPDATE`,
          [zoneId],
        )
        if (!rows[0]) {
          await conn.rollback()
          throw new HazardZoneNotFoundError(zoneId)
        }
        await conn.execute(
          `UPDATE atc_hazard_zones SET status = ?, updated_at = NOW(3) WHERE zone_id = ?`,
          [status, zoneId] as (string | number | boolean | null)[],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [updated] = await conn.execute<HazardZoneRow[]>(
        `SELECT * FROM atc_hazard_zones WHERE zone_id = ? LIMIT 1`,
        [zoneId],
      )
      if (!updated[0]) throw new HazardZoneNotFoundError(zoneId)
      return rowToHazardZone(updated[0])
    } finally {
      conn.release()
    }
  }
}
