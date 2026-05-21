import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EcologyRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateEcologyError, EcologyNotFoundError } from './errors.js'

export type AtcEcologyType = 'forest' | 'ocean' | 'desert' | 'tundra' | 'urban' | 'custom'
export type AtcEcologyStatus = 'stable' | 'degrading' | 'recovering' | 'critical'

export interface AtcEcologyRuntime {
  id: string
  ecologyId: string
  ecologyType: AtcEcologyType
  status: AtcEcologyStatus
  ownerServerId: string
  regionId: string | null
  ecologyNonce: string
  ecologyData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface EcologyRuntimeRow extends RowDataPacket {
  id: string
  ecology_id: string
  ecology_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  ecology_nonce: string
  ecology_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: EcologyRuntimeRow): AtcEcologyRuntime {
  let ecologyData: Record<string, unknown> = {}
  try {
    const parsed: unknown = typeof row.ecology_data === 'string'
      ? JSON.parse(row.ecology_data)
      : row.ecology_data
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      ecologyData = parsed as Record<string, unknown>
    }
  } catch {
    ecologyData = {}
  }
  return {
    id: row.id,
    ecologyId: row.ecology_id,
    ecologyType: row.ecology_type as AtcEcologyType,
    status: row.status as AtcEcologyStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    ecologyNonce: row.ecology_nonce,
    ecologyData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateEcologyParams {
  ecologyId: string
  ecologyType: AtcEcologyType
  status: AtcEcologyStatus
  ownerServerId: string
  regionId?: string | null
  ecologyNonce: string
  ecologyData?: Record<string, unknown>
}

export class EcologyRuntimeRepository {
  constructor(private readonly pool: EcologyRuntimePool) {}

  async create(params: CreateEcologyParams): Promise<AtcEcologyRuntime> {
    const id = generateId()
    const ecologyData = JSON.stringify(params.ecologyData ?? {})
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_ecology_runtime
             (id, ecology_id, ecology_type, status, owner_server_id, region_id,
              ecology_nonce, ecology_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.ecologyId,
            params.ecologyType,
            params.status,
            params.ownerServerId,
            params.regionId ?? null,
            params.ecologyNonce,
            ecologyData,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateEcologyError(params.ecologyId)
        }
        throw err
      }
      const [rows] = await conn.execute<EcologyRuntimeRow[]>(
        `SELECT * FROM atc_ecology_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EcologyNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEcologyRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<EcologyRuntimeRow[]>(
        `SELECT * FROM atc_ecology_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      return row ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcEcologyStatus): Promise<AtcEcologyRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<EcologyRuntimeRow[]>(
          `SELECT * FROM atc_ecology_runtime WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          await conn.rollback()
          throw new EcologyNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_ecology_runtime SET status = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<EcologyRuntimeRow[]>(
        `SELECT * FROM atc_ecology_runtime WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EcologyNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string): Promise<AtcEcologyRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<EcologyRuntimeRow[]>(
          `SELECT * FROM atc_ecology_runtime
           WHERE status IN ('stable','recovering') AND owner_server_id = ?
           ORDER BY created_at DESC`,
          [ownerServerId],
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<EcologyRuntimeRow[]>(
        `SELECT * FROM atc_ecology_runtime
         WHERE status IN ('stable','recovering')
         ORDER BY created_at DESC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_ecology_runtime
         WHERE status IN ('critical','degrading')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
