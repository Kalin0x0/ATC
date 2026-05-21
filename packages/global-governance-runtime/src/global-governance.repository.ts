import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GlobalGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateGovernanceDirectiveError, GovernanceDirectiveNotFoundError } from './errors.js'

export type AtcGovernanceDirectiveType = 'mandate' | 'advisory' | 'prohibition' | 'emergency' | 'custom'
export type AtcGovernanceDirectiveStatus = 'pending' | 'active' | 'resolved' | 'failed' | 'expired'

export interface AtcGlobalGovernance {
  id: string
  directiveId: string
  directiveType: AtcGovernanceDirectiveType
  status: AtcGovernanceDirectiveStatus
  ownerServerId: string
  directiveNonce: string
  directiveData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateGovernanceDirectiveParams {
  directiveType: AtcGovernanceDirectiveType
  ownerServerId: string
  directiveNonce: string
  directiveData?: Record<string, unknown> | undefined
}

interface GlobalGovernanceRow extends RowDataPacket {
  id: string
  directive_id: string
  directive_type: string
  status: string
  owner_server_id: string
  directive_nonce: string
  directive_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: GlobalGovernanceRow): AtcGlobalGovernance {
  let directiveData: Record<string, unknown> = {}
  if (row.directive_data) {
    try {
      directiveData = JSON.parse(row.directive_data) as Record<string, unknown>
    } catch {
      directiveData = {}
    }
  }
  return {
    id: row.id,
    directiveId: row.directive_id,
    directiveType: row.directive_type as AtcGovernanceDirectiveType,
    status: row.status as AtcGovernanceDirectiveStatus,
    ownerServerId: row.owner_server_id,
    directiveNonce: row.directive_nonce,
    directiveData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class GlobalGovernanceRepository {
  constructor(private readonly pool: GlobalGovernancePool) {}

  async create(params: CreateGovernanceDirectiveParams): Promise<AtcGlobalGovernance> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const directiveId = generateId()
      const directiveDataJson = JSON.stringify(params.directiveData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_global_governance
             (id, directive_id, directive_type, status, owner_server_id, directive_nonce,
              directive_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            directiveId,
            params.directiveType,
            params.ownerServerId,
            params.directiveNonce,
            directiveDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateGovernanceDirectiveError(params.directiveNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<GlobalGovernanceRow[]>(
        `SELECT id, directive_id, directive_type, status, owner_server_id, directive_nonce,
                directive_data, completed_at, created_at, updated_at
         FROM atc_global_governance
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Global governance record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcGlobalGovernance | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GlobalGovernanceRow[]>(
        `SELECT id, directive_id, directive_type, status, owner_server_id, directive_nonce,
                directive_data, completed_at, created_at, updated_at
         FROM atc_global_governance
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcGovernanceDirectiveStatus,
    completedAt?: Date | undefined
  ): Promise<AtcGlobalGovernance> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<GlobalGovernanceRow[]>(
          `SELECT id, directive_id, directive_type, status, owner_server_id, directive_nonce,
                  directive_data, completed_at, created_at, updated_at
           FROM atc_global_governance
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new GovernanceDirectiveNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_global_governance
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              completedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_global_governance
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<GlobalGovernanceRow[]>(
          `SELECT id, directive_id, directive_type, status, owner_server_id, directive_nonce,
                  directive_data, completed_at, created_at, updated_at
           FROM atc_global_governance
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new GovernanceDirectiveNotFoundError(id)

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
        `DELETE FROM atc_global_governance
         WHERE status IN ('resolved', 'failed', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
