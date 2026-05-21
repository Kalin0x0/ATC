import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GlobalGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { PolicyNotFoundError } from './errors.js'

export type AtcPolicyType = 'resource' | 'access' | 'behavior' | 'rate_limit' | 'security' | 'custom'
export type AtcPolicyStatus = 'active' | 'suspended' | 'revoked' | 'expired'

export interface AtcGlobalPolicy {
  id: string
  policyId: string
  policyType: AtcPolicyType
  status: AtcPolicyStatus
  ownerServerId: string
  policyData: Record<string, unknown>
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UpsertPolicyParams {
  policyId: string
  policyType: AtcPolicyType
  ownerServerId: string
  policyData?: Record<string, unknown> | undefined
}

interface GlobalPolicyRow extends RowDataPacket {
  id: string
  policy_id: string
  policy_type: string
  status: string
  owner_server_id: string
  policy_data: string | null
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: GlobalPolicyRow): AtcGlobalPolicy {
  let policyData: Record<string, unknown> = {}
  if (row.policy_data) {
    try {
      policyData = JSON.parse(row.policy_data) as Record<string, unknown>
    } catch {
      policyData = {}
    }
  }
  return {
    id: row.id,
    policyId: row.policy_id,
    policyType: row.policy_type as AtcPolicyType,
    status: row.status as AtcPolicyStatus,
    ownerServerId: row.owner_server_id,
    policyData,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class GlobalPolicyRepository {
  constructor(private readonly pool: GlobalGovernancePool) {}

  async upsert(params: UpsertPolicyParams): Promise<AtcGlobalPolicy> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const policyDataJson = JSON.stringify(params.policyData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_global_policies
           (id, policy_id, policy_type, status, owner_server_id,
            policy_data, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           policy_type = VALUES(policy_type),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           policy_data = VALUES(policy_data),
           updated_at = NOW(3)`,
        [
          id,
          params.policyId,
          params.policyType,
          params.ownerServerId,
          policyDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<GlobalPolicyRow[]>(
        `SELECT id, policy_id, policy_type, status, owner_server_id,
                policy_data, expires_at, created_at, updated_at
         FROM atc_global_policies
         WHERE policy_id = ?
         LIMIT 1`,
        [params.policyId]
      )
      if (!rows[0]) throw new Error(`Global policy record not found after upsert: ${params.policyId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByPolicyId(policyId: string): Promise<AtcGlobalPolicy | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GlobalPolicyRow[]>(
        `SELECT id, policy_id, policy_type, status, owner_server_id,
                policy_data, expires_at, created_at, updated_at
         FROM atc_global_policies
         WHERE policy_id = ?
         LIMIT 1`,
        [policyId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcPolicyStatus): Promise<AtcGlobalPolicy> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<GlobalPolicyRow[]>(
          `SELECT id, policy_id, policy_type, status, owner_server_id,
                  policy_data, expires_at, created_at, updated_at
           FROM atc_global_policies
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new PolicyNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_global_policies
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id] as (string | number | boolean | null)[]
        )

        const [rows] = await conn.execute<GlobalPolicyRow[]>(
          `SELECT id, policy_id, policy_type, status, owner_server_id,
                  policy_data, expires_at, created_at, updated_at
           FROM atc_global_policies
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new PolicyNotFoundError(id)

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
        `DELETE FROM atc_global_policies
         WHERE status IN ('revoked', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
