import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReleaseGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { ReleaseGovernanceNotFoundError, DuplicateReleaseGovernanceError } from './errors.js'

export type AtcGovernanceType = 'policy' | 'compliance' | 'review' | 'approval' | 'custom'
export type AtcGovernanceStatus = 'pending' | 'active' | 'approved' | 'rejected' | 'failed'

export interface AtcReleaseGovernance {
  id: string
  governanceId: string
  governanceType: AtcGovernanceType
  status: AtcGovernanceStatus
  ownerServerId: string
  governanceNonce: string
  governanceData: Record<string, unknown>
  startedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateGovernanceParams {
  governanceType: AtcGovernanceType
  ownerServerId: string
  governanceNonce: string
  governanceData?: Record<string, unknown> | undefined
}

interface ReleaseGovernanceRow extends RowDataPacket {
  id: string
  governance_id: string
  governance_type: string
  status: string
  owner_server_id: string
  governance_nonce: string
  governance_data: string | null
  started_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ReleaseGovernanceRow): AtcReleaseGovernance {
  let governanceData: Record<string, unknown> = {}
  if (row.governance_data) {
    try {
      governanceData = JSON.parse(row.governance_data) as Record<string, unknown>
    } catch {
      governanceData = {}
    }
  }
  return {
    id: row.id,
    governanceId: row.governance_id,
    governanceType: row.governance_type as AtcGovernanceType,
    status: row.status as AtcGovernanceStatus,
    ownerServerId: row.owner_server_id,
    governanceNonce: row.governance_nonce,
    governanceData,
    startedAt: row.started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ReleaseGovernanceRepository {
  constructor(private readonly pool: ReleaseGovernancePool) {}

  async create(params: CreateGovernanceParams): Promise<AtcReleaseGovernance> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const governanceId = generateId()
      const governanceDataJson = JSON.stringify(params.governanceData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_release_governance
             (id, governance_id, governance_type, status, owner_server_id,
              governance_nonce, governance_data, started_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            governanceId,
            params.governanceType,
            params.ownerServerId,
            params.governanceNonce,
            governanceDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateReleaseGovernanceError(params.governanceNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ReleaseGovernanceRow[]>(
        `SELECT id, governance_id, governance_type, status, owner_server_id,
                governance_nonce, governance_data, started_at, created_at, updated_at
         FROM atc_release_governance
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Release governance not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcReleaseGovernance | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReleaseGovernanceRow[]>(
        `SELECT id, governance_id, governance_type, status, owner_server_id,
                governance_nonce, governance_data, started_at, created_at, updated_at
         FROM atc_release_governance
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcGovernanceStatus,
    startedAt?: Date | undefined
  ): Promise<AtcReleaseGovernance> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ReleaseGovernanceRow[]>(
          `SELECT id, governance_id, governance_type, status, owner_server_id,
                  governance_nonce, governance_data, started_at, created_at, updated_at
           FROM atc_release_governance
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new ReleaseGovernanceNotFoundError(id)

        if (startedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_release_governance
             SET status = ?, started_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, startedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_release_governance
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<ReleaseGovernanceRow[]>(
          `SELECT id, governance_id, governance_type, status, owner_server_id,
                  governance_nonce, governance_data, started_at, created_at, updated_at
           FROM atc_release_governance
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new ReleaseGovernanceNotFoundError(id)

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
        `DELETE FROM atc_release_governance
         WHERE status IN ('rejected', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
