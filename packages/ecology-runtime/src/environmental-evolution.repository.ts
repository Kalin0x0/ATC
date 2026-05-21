import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EcologyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateEvolutionError, EvolutionNotFoundError } from './errors.js'

export type AtcEvolutionType =
  | 'climate_shift'
  | 'biome_change'
  | 'species_migration'
  | 'pollution'
  | 'restoration'
  | 'custom'

export type AtcEvolutionStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcEnvironmentalEvolution {
  id: string
  evolutionId: string
  evolutionType: AtcEvolutionType
  status: AtcEvolutionStatus
  ownerServerId: string
  regionId: string | null
  evolutionNonce: string
  evolutionData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface EnvironmentalEvolutionRow extends RowDataPacket {
  id: string
  evolution_id: string
  evolution_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  evolution_nonce: string
  evolution_data: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: EnvironmentalEvolutionRow): AtcEnvironmentalEvolution {
  let evolutionData: Record<string, unknown> = {}
  try {
    const parsed: unknown = typeof row.evolution_data === 'string'
      ? JSON.parse(row.evolution_data)
      : row.evolution_data
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      evolutionData = parsed as Record<string, unknown>
    }
  } catch {
    evolutionData = {}
  }
  return {
    id: row.id,
    evolutionId: row.evolution_id,
    evolutionType: row.evolution_type as AtcEvolutionType,
    status: row.status as AtcEvolutionStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    evolutionNonce: row.evolution_nonce,
    evolutionData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateEvolutionParams {
  evolutionId: string
  evolutionType: AtcEvolutionType
  status: AtcEvolutionStatus
  ownerServerId: string
  regionId?: string | null
  evolutionNonce: string
  evolutionData?: Record<string, unknown>
}

export class EnvironmentalEvolutionRepository {
  constructor(private readonly pool: EcologyRuntimePool) {}

  async create(params: CreateEvolutionParams): Promise<AtcEnvironmentalEvolution> {
    const id = generateId()
    const evolutionData = JSON.stringify(params.evolutionData ?? {})
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_environmental_evolution
             (id, evolution_id, evolution_type, status, owner_server_id, region_id,
              evolution_nonce, evolution_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            params.evolutionId,
            params.evolutionType,
            params.status,
            params.ownerServerId,
            params.regionId ?? null,
            params.evolutionNonce,
            evolutionData,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateEvolutionError(params.evolutionId)
        }
        throw err
      }
      const [rows] = await conn.execute<EnvironmentalEvolutionRow[]>(
        `SELECT * FROM atc_environmental_evolution WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EvolutionNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEnvironmentalEvolution | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EnvironmentalEvolutionRow[]>(
        `SELECT * FROM atc_environmental_evolution WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      return row ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcEvolutionStatus,
    completedAt?: Date,
  ): Promise<AtcEnvironmentalEvolution> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<EnvironmentalEvolutionRow[]>(
          `SELECT * FROM atc_environmental_evolution WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          await conn.rollback()
          throw new EvolutionNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_environmental_evolution
           SET status = ?, completed_at = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, completedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<EnvironmentalEvolutionRow[]>(
        `SELECT * FROM atc_environmental_evolution WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EvolutionNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_environmental_evolution
         WHERE status IN ('failed','completed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
