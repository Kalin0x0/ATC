import type { RowDataPacket } from 'mysql2/promise'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { EnvironmentalHazardNotFoundError, HazardAlreadyActiveError } from './errors.js'

export interface AtcEnvironmentalHazard {
  id: string
  hazardId: string
  hazardType: string
  zoneId: string
  severity: number
  isActive: boolean
  ownerServerId: string | null
  startedAt: Date | null
  endedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface EnvironmentalHazardRow extends RowDataPacket {
  id: string
  hazard_id: string
  hazard_type: string
  zone_id: string
  severity: number
  is_active: number
  owner_server_id: string | null
  started_at: Date | null
  ended_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToHazard(row: EnvironmentalHazardRow): AtcEnvironmentalHazard {
  return {
    id: row.id,
    hazardId: row.hazard_id,
    hazardType: row.hazard_type,
    zoneId: row.zone_id,
    severity: Number(row.severity),
    isActive: row.is_active === 1,
    ownerServerId: row.owner_server_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class EnvironmentalHazardRepository {
  constructor(private readonly pool: SurvivalRuntimePool) {}

  async create(
    hazardId: string,
    hazardType: string,
    zoneId: string,
    severity: number,
    ownerServerId?: string | undefined,
  ): Promise<AtcEnvironmentalHazard> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_environmental_hazards
             (id, hazard_id, hazard_type, zone_id, severity, is_active,
              owner_server_id, started_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, NOW(3), NOW(3), NOW(3))`,
          [id, hazardId, hazardType, zoneId, severity, ownerServerId ?? null],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new HazardAlreadyActiveError(hazardId)
        }
        throw err
      }
      const [rows] = await conn.execute<EnvironmentalHazardRow[]>(
        `SELECT * FROM atc_environmental_hazards WHERE hazard_id = ? LIMIT 1`,
        [hazardId],
      )
      if (!rows[0]) throw new EnvironmentalHazardNotFoundError(hazardId)
      return rowToHazard(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByHazardId(hazardId: string): Promise<AtcEnvironmentalHazard | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentalHazardRow[]>(
        `SELECT * FROM atc_environmental_hazards WHERE hazard_id = ? LIMIT 1`,
        [hazardId],
      )
      return rows[0] ? rowToHazard(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async deactivate(hazardId: string): Promise<AtcEnvironmentalHazard> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<EnvironmentalHazardRow[]>(
          `SELECT * FROM atc_environmental_hazards WHERE hazard_id = ? LIMIT 1 FOR UPDATE`,
          [hazardId],
        )
        if (!lockRows[0]) throw new EnvironmentalHazardNotFoundError(hazardId)

        await conn.execute(
          `UPDATE atc_environmental_hazards
           SET is_active  = 0,
               ended_at   = NOW(3),
               updated_at = NOW(3)
           WHERE hazard_id = ?`,
          [hazardId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<EnvironmentalHazardRow[]>(
        `SELECT * FROM atc_environmental_hazards WHERE hazard_id = ? LIMIT 1`,
        [hazardId],
      )
      if (!rows[0]) throw new EnvironmentalHazardNotFoundError(hazardId)
      return rowToHazard(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcEnvironmentalHazard[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentalHazardRow[]>(
        `SELECT * FROM atc_environmental_hazards WHERE is_active = 1 ORDER BY started_at DESC`,
      )
      return rows.map(rowToHazard)
    } finally {
      conn.release()
    }
  }

  async listByZone(zoneId: string): Promise<AtcEnvironmentalHazard[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentalHazardRow[]>(
        `SELECT * FROM atc_environmental_hazards
         WHERE zone_id = ? AND is_active = 1
         ORDER BY started_at DESC`,
        [zoneId],
      )
      return rows.map(rowToHazard)
    } finally {
      conn.release()
    }
  }
}
