import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FederationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ConsistencyCheckNotFoundError, DuplicateConsistencyCheckError } from './errors.js'

export type AtcConsistencyCheckType = 'hash' | 'count' | 'timestamp' | 'full' | 'custom'
export type AtcConsistencyCheckStatus = 'pending' | 'passed' | 'failed' | 'skipped'

export interface AtcRegionalConsistency {
  id: string
  checkId: string
  regionId: string
  checkType: AtcConsistencyCheckType
  status: AtcConsistencyCheckStatus
  ownerServerId: string
  checkNonce: string
  completedAt: Date | null
  checkData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateConsistencyCheckParams {
  regionId: string
  checkType: AtcConsistencyCheckType
  ownerServerId: string
  checkNonce: string
  checkData?: Record<string, unknown> | undefined
}

interface RegionalConsistencyRow extends RowDataPacket {
  id: string
  check_id: string
  region_id: string
  check_type: string
  status: string
  owner_server_id: string
  check_nonce: string
  completed_at: Date | null
  check_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RegionalConsistencyRow): AtcRegionalConsistency {
  let checkData: Record<string, unknown> = {}
  if (row.check_data) {
    try { checkData = JSON.parse(row.check_data) as Record<string, unknown> } catch { checkData = {} }
  }
  return {
    id: row.id,
    checkId: row.check_id,
    regionId: row.region_id,
    checkType: row.check_type as AtcConsistencyCheckType,
    status: row.status as AtcConsistencyCheckStatus,
    ownerServerId: row.owner_server_id,
    checkNonce: row.check_nonce,
    completedAt: row.completed_at,
    checkData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RegionalConsistencyRepository {
  constructor(private readonly pool: FederationRuntimePool) {}

  async create(params: CreateConsistencyCheckParams): Promise<AtcRegionalConsistency> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const checkId = generateId()
      const checkDataJson = JSON.stringify(params.checkData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_regional_consistency
             (id, check_id, region_id, check_type, status, owner_server_id, check_nonce,
              completed_at, check_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, NULL, ?, NOW(3), NOW(3))`,
          [id, checkId, params.regionId, params.checkType, params.ownerServerId,
           params.checkNonce, checkDataJson] as string[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateConsistencyCheckError(params.checkNonce)
        throw err
      }

      const [rows] = await conn.execute<RegionalConsistencyRow[]>(
        `SELECT id, check_id, region_id, check_type, status, owner_server_id, check_nonce,
                completed_at, check_data, created_at, updated_at
         FROM atc_regional_consistency WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Regional consistency check not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRegionalConsistency | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegionalConsistencyRow[]>(
        `SELECT id, check_id, region_id, check_type, status, owner_server_id, check_nonce,
                completed_at, check_data, created_at, updated_at
         FROM atc_regional_consistency WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcConsistencyCheckStatus, completedAt?: Date | undefined): Promise<AtcRegionalConsistency> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RegionalConsistencyRow[]>(
          `SELECT id, check_id, region_id, check_type, status, owner_server_id, check_nonce,
                  completed_at, check_data, created_at, updated_at
           FROM atc_regional_consistency WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ConsistencyCheckNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_regional_consistency SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_regional_consistency SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<RegionalConsistencyRow[]>(
          `SELECT id, check_id, region_id, check_type, status, owner_server_id, check_nonce,
                  completed_at, check_data, created_at, updated_at
           FROM atc_regional_consistency WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ConsistencyCheckNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_regional_consistency
         WHERE status IN ('passed', 'failed', 'skipped')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
