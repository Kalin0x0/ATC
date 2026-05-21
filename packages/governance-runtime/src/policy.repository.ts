import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GovernanceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicatePolicyError, PolicyNotFoundError } from './errors.js'

export type AtcPolicyType = 'economic' | 'social' | 'military' | 'environmental' | 'governance' | 'custom'
export type AtcPolicyStatus = 'active' | 'revoked' | 'expired' | 'pending'

export interface AtcPolicyRuntime {
  id: string
  policyId: string
  policyType: AtcPolicyType
  status: AtcPolicyStatus
  ownerServerId: string
  regionId: string | null
  policyNonce: string
  policyData: Record<string, unknown>
  appliedAt: Date
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface PolicyRow extends RowDataPacket {
  id: string
  policy_id: string
  policy_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  policy_nonce: string
  policy_data: string
  applied_at: Date
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: PolicyRow): AtcPolicyRuntime {
  let policyData: Record<string, unknown> = {}
  try {
    policyData = JSON.parse(row.policy_data) as Record<string, unknown>
  } catch {
    policyData = {}
  }
  return {
    id: row.id,
    policyId: row.policy_id,
    policyType: row.policy_type as AtcPolicyType,
    status: row.status as AtcPolicyStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    policyNonce: row.policy_nonce,
    policyData,
    appliedAt: row.applied_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreatePolicyParams {
  policyId: string
  policyType: AtcPolicyType
  ownerServerId: string
  regionId?: string | null | undefined
  policyNonce: string
  policyData?: Record<string, unknown> | undefined
  appliedAt?: Date | undefined
  expiresAt?: Date | null | undefined
}

export class PolicyRepository {
  constructor(private readonly pool: GovernanceRuntimePool) {}

  async create(params: CreatePolicyParams): Promise<AtcPolicyRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const policyDataJson = JSON.stringify(params.policyData ?? {})
      const appliedAt = params.appliedAt ?? new Date()
      const expiresAt = params.expiresAt ?? null
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_policy_runtime
             (id, policy_id, policy_type, status, owner_server_id, region_id,
              policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.policyId,
            params.policyType,
            params.ownerServerId,
            params.regionId ?? null,
            params.policyNonce,
            policyDataJson,
            appliedAt,
            expiresAt,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicatePolicyError(params.policyId)
        }
        throw err
      }
      const [rows] = await conn.execute<PolicyRow[]>(
        `SELECT id, policy_id, policy_type, status, owner_server_id, region_id,
                policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at
         FROM atc_policy_runtime
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Policy not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcPolicyRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PolicyRow[]>(
        `SELECT id, policy_id, policy_type, status, owner_server_id, region_id,
                policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at
         FROM atc_policy_runtime
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcPolicyStatus): Promise<AtcPolicyRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<PolicyRow[]>(
          `SELECT id, policy_id, policy_type, status, owner_server_id, region_id,
                  policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at
           FROM atc_policy_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new PolicyNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_policy_runtime
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id],
        )

        const [updated] = await conn.execute<PolicyRow[]>(
          `SELECT id, policy_id, policy_type, status, owner_server_id, region_id,
                  policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at
           FROM atc_policy_runtime
           WHERE id = ?
           LIMIT 1`,
          [id],
        )
        if (!updated[0]) throw new PolicyNotFoundError(id)

        await conn.commit()
        return mapRow(updated[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string): Promise<AtcPolicyRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<PolicyRow[]>(
          `SELECT id, policy_id, policy_type, status, owner_server_id, region_id,
                  policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at
           FROM atc_policy_runtime
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId],
        )
        return rows.map(mapRow)
      } else {
        const [rows] = await conn.execute<PolicyRow[]>(
          `SELECT id, policy_id, policy_type, status, owner_server_id, region_id,
                  policy_nonce, policy_data, applied_at, expires_at, created_at, updated_at
           FROM atc_policy_runtime
           WHERE status = 'active'
           ORDER BY created_at ASC`,
        )
        return rows.map(mapRow)
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdDate = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_policy_runtime
         WHERE status IN ('revoked', 'expired')
           AND updated_at < ?`,
        [thresholdDate],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
