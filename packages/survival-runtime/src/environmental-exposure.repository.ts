import type { RowDataPacket } from 'mysql2/promise'
import type { SurvivalRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcEnvironmentalExposure {
  id: string
  playerId: string
  hazardId: string
  exposureType: string
  severity: number
  exposedAt: Date
  endedAt: Date | null
  createdAt: Date
}

interface EnvironmentalExposureRow extends RowDataPacket {
  id: string
  player_id: string
  hazard_id: string
  exposure_type: string
  severity: number
  exposed_at: Date
  ended_at: Date | null
  created_at: Date
}

function rowToExposure(row: EnvironmentalExposureRow): AtcEnvironmentalExposure {
  return {
    id: row.id,
    playerId: row.player_id,
    hazardId: row.hazard_id,
    exposureType: row.exposure_type,
    severity: Number(row.severity),
    exposedAt: row.exposed_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  }
}

export class EnvironmentalExposureRepository {
  constructor(private readonly pool: SurvivalRuntimePool) {}

  async recordExposure(
    playerId: string,
    hazardId: string,
    exposureType: string,
    severity: number,
  ): Promise<AtcEnvironmentalExposure> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_environmental_exposure
           (id, player_id, hazard_id, exposure_type, severity, exposed_at, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, playerId, hazardId, exposureType, severity],
      )
      const [rows] = await conn.execute<EnvironmentalExposureRow[]>(
        `SELECT * FROM atc_environmental_exposure WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Exposure record not found after insert: ${id}`)
      return rowToExposure(rows[0])
    } finally {
      conn.release()
    }
  }

  async endExposure(playerId: string, hazardId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_environmental_exposure
         SET ended_at = NOW(3)
         WHERE player_id = ? AND hazard_id = ? AND ended_at IS NULL`,
        [playerId, hazardId],
      )
    } finally {
      conn.release()
    }
  }

  async listActiveByPlayer(playerId: string): Promise<AtcEnvironmentalExposure[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentalExposureRow[]>(
        `SELECT * FROM atc_environmental_exposure
         WHERE player_id = ? AND ended_at IS NULL
         ORDER BY exposed_at DESC`,
        [playerId],
      )
      return rows.map(rowToExposure)
    } finally {
      conn.release()
    }
  }

  async listRecent(playerId: string, limit: number): Promise<AtcEnvironmentalExposure[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentalExposureRow[]>(
        `SELECT * FROM atc_environmental_exposure
         WHERE player_id = ?
         ORDER BY exposed_at DESC
         LIMIT ?`,
        [playerId, limit],
      )
      return rows.map(rowToExposure)
    } finally {
      conn.release()
    }
  }
}
