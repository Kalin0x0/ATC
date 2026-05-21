import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EconomyRegulationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateRegulationError, RegulationNotFoundError } from './errors.js'

export type AtcRegulationType = 'price_floor' | 'price_ceiling' | 'supply_cap' | 'demand_cap' | 'subsidy' | 'custom'
export type AtcRegulationStatus = 'active' | 'suspended' | 'expired' | 'cancelled'

export interface AtcEconomyRegulation {
  id: string
  regulationId: string
  regionId: string | null
  regulationType: AtcRegulationType
  status: AtcRegulationStatus
  ownerServerId: string
  regulationNonce: string
  regulationData: Record<string, unknown>
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateRegulationParams {
  regulationType: AtcRegulationType
  ownerServerId: string
  regulationNonce: string
  regionId?: string | undefined
  regulationData?: Record<string, unknown> | undefined
  expiresAt?: Date | undefined
}

interface RegulationRow extends RowDataPacket {
  id: string
  regulation_id: string
  region_id: string | null
  regulation_type: AtcRegulationType
  status: AtcRegulationStatus
  owner_server_id: string
  regulation_nonce: string
  regulation_data: string
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RegulationRow): AtcEconomyRegulation {
  return {
    id: row.id,
    regulationId: row.regulation_id,
    regionId: row.region_id,
    regulationType: row.regulation_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    regulationNonce: row.regulation_nonce,
    regulationData: typeof row.regulation_data === 'string'
      ? (JSON.parse(row.regulation_data) as Record<string, unknown>)
      : (row.regulation_data as unknown as Record<string, unknown>),
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class EconomyRegulationRepository {
  constructor(private pool: EconomyRegulationPool) {}

  async create(params: CreateRegulationParams): Promise<AtcEconomyRegulation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const regulationId = generateId()
      const regulationData = JSON.stringify(params.regulationData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_economy_regulation
            (id, regulation_id, region_id, regulation_type, status, owner_server_id, regulation_nonce, regulation_data, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, NOW(3), NOW(3))`,
          [id, regulationId, params.regionId ?? null, params.regulationType, params.ownerServerId, params.regulationNonce, regulationData, params.expiresAt ?? null],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateRegulationError(params.regulationNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<RegulationRow[]>(
        'SELECT * FROM atc_economy_regulation WHERE id = ?',
        [id],
      )
      return mapRow(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcEconomyRegulation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegulationRow[]>(
        'SELECT * FROM atc_economy_regulation WHERE id = ?',
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcRegulationStatus): Promise<AtcEconomyRegulation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [locked] = await conn.execute<RegulationRow[]>(
        'SELECT * FROM atc_economy_regulation WHERE id = ? FOR UPDATE',
        [id],
      )
      if (!locked[0]) {
        await conn.rollback()
        throw new RegulationNotFoundError(id)
      }
      await conn.execute<ResultSetHeader>(
        'UPDATE atc_economy_regulation SET status = ?, updated_at = NOW(3) WHERE id = ?',
        [status, id],
      )
      await conn.commit()
      const [rows] = await conn.execute<RegulationRow[]>(
        'SELECT * FROM atc_economy_regulation WHERE id = ?',
        [id],
      )
      return mapRow(rows[0]!)
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string): Promise<AtcEconomyRegulation[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<RegulationRow[]>(
          "SELECT * FROM atc_economy_regulation WHERE status = 'active' AND owner_server_id = ?",
          [ownerServerId],
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<RegulationRow[]>(
        "SELECT * FROM atc_economy_regulation WHERE status = 'active'",
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        "DELETE FROM atc_economy_regulation WHERE status IN ('expired', 'cancelled') AND updated_at < ?",
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
