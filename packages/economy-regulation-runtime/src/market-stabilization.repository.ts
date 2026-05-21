import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EconomyRegulationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateStabilizationError, StabilizationNotFoundError } from './errors.js'

export type AtcMarketType = 'goods' | 'services' | 'real_estate' | 'labor' | 'financial' | 'custom'
export type AtcStabilizationStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcMarketStabilization {
  id: string
  stabilizationId: string
  marketType: AtcMarketType
  status: AtcStabilizationStatus
  ownerServerId: string
  stabilizationNonce: string
  regionId: string | null
  stabilizationData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateStabilizationParams {
  marketType: AtcMarketType
  ownerServerId: string
  stabilizationNonce: string
  regionId?: string | undefined
  stabilizationData?: Record<string, unknown> | undefined
}

interface StabilizationRow extends RowDataPacket {
  id: string
  stabilization_id: string
  market_type: AtcMarketType
  status: AtcStabilizationStatus
  owner_server_id: string
  stabilization_nonce: string
  region_id: string | null
  stabilization_data: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: StabilizationRow): AtcMarketStabilization {
  return {
    id: row.id,
    stabilizationId: row.stabilization_id,
    marketType: row.market_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    stabilizationNonce: row.stabilization_nonce,
    regionId: row.region_id,
    stabilizationData: typeof row.stabilization_data === 'string'
      ? (JSON.parse(row.stabilization_data) as Record<string, unknown>)
      : (row.stabilization_data as unknown as Record<string, unknown>),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class MarketStabilizationRepository {
  constructor(private pool: EconomyRegulationPool) {}

  async create(params: CreateStabilizationParams): Promise<AtcMarketStabilization> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const stabilizationId = generateId()
      const stabilizationData = JSON.stringify(params.stabilizationData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_market_stabilization
            (id, stabilization_id, market_type, status, owner_server_id, stabilization_nonce, region_id, stabilization_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, stabilizationId, params.marketType, params.ownerServerId, params.stabilizationNonce, params.regionId ?? null, stabilizationData],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateStabilizationError(params.stabilizationNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<StabilizationRow[]>(
        'SELECT * FROM atc_market_stabilization WHERE id = ?',
        [id],
      )
      return mapRow(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcMarketStabilization | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StabilizationRow[]>(
        'SELECT * FROM atc_market_stabilization WHERE id = ?',
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcStabilizationStatus, completedAt?: Date): Promise<AtcMarketStabilization> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [locked] = await conn.execute<StabilizationRow[]>(
        'SELECT * FROM atc_market_stabilization WHERE id = ? FOR UPDATE',
        [id],
      )
      if (!locked[0]) {
        await conn.rollback()
        throw new StabilizationNotFoundError(id)
      }
      await conn.execute<ResultSetHeader>(
        'UPDATE atc_market_stabilization SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?',
        [status, completedAt ?? null, id],
      )
      await conn.commit()
      const [rows] = await conn.execute<StabilizationRow[]>(
        'SELECT * FROM atc_market_stabilization WHERE id = ?',
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

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        "DELETE FROM atc_market_stabilization WHERE status IN ('completed', 'failed') AND updated_at < ?",
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
