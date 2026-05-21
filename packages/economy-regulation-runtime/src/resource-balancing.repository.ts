import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EconomyRegulationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateBalancingError, BalancingNotFoundError } from './errors.js'

export type AtcResourceType = 'cash' | 'goods' | 'property' | 'jobs' | 'housing' | 'custom'
export type AtcBalancingStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcResourceBalancing {
  id: string
  balancingId: string
  resourceType: AtcResourceType
  status: AtcBalancingStatus
  ownerServerId: string
  balancingNonce: string
  targetRegionId: string | null
  balancingData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateBalancingParams {
  resourceType: AtcResourceType
  ownerServerId: string
  balancingNonce: string
  targetRegionId?: string | undefined
  balancingData?: Record<string, unknown> | undefined
}

interface BalancingRow extends RowDataPacket {
  id: string
  balancing_id: string
  resource_type: AtcResourceType
  status: AtcBalancingStatus
  owner_server_id: string
  balancing_nonce: string
  target_region_id: string | null
  balancing_data: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: BalancingRow): AtcResourceBalancing {
  return {
    id: row.id,
    balancingId: row.balancing_id,
    resourceType: row.resource_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    balancingNonce: row.balancing_nonce,
    targetRegionId: row.target_region_id,
    balancingData: typeof row.balancing_data === 'string'
      ? (JSON.parse(row.balancing_data) as Record<string, unknown>)
      : (row.balancing_data as unknown as Record<string, unknown>),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ResourceBalancingRepository {
  constructor(private pool: EconomyRegulationPool) {}

  async create(params: CreateBalancingParams): Promise<AtcResourceBalancing> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const balancingId = generateId()
      const balancingData = JSON.stringify(params.balancingData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_resource_balancing
            (id, balancing_id, resource_type, status, owner_server_id, balancing_nonce, target_region_id, balancing_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, balancingId, params.resourceType, params.ownerServerId, params.balancingNonce, params.targetRegionId ?? null, balancingData],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateBalancingError(params.balancingNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<BalancingRow[]>(
        'SELECT * FROM atc_resource_balancing WHERE id = ?',
        [id],
      )
      return mapRow(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcResourceBalancing | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BalancingRow[]>(
        'SELECT * FROM atc_resource_balancing WHERE id = ?',
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcBalancingStatus, completedAt?: Date): Promise<AtcResourceBalancing> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      const [locked] = await conn.execute<BalancingRow[]>(
        'SELECT * FROM atc_resource_balancing WHERE id = ? FOR UPDATE',
        [id],
      )
      if (!locked[0]) {
        await conn.rollback()
        throw new BalancingNotFoundError(id)
      }
      await conn.execute<ResultSetHeader>(
        'UPDATE atc_resource_balancing SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?',
        [status, completedAt ?? null, id],
      )
      await conn.commit()
      const [rows] = await conn.execute<BalancingRow[]>(
        'SELECT * FROM atc_resource_balancing WHERE id = ?',
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
        "DELETE FROM atc_resource_balancing WHERE status IN ('completed', 'failed') AND updated_at < ?",
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
