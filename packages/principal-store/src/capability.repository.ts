import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CapabilityAssignment } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { PrincipalStorePool } from './pool.js'

interface CapabilityRow extends RowDataPacket {
  id: string
  principal_id: string
  capability: string
  granted_by: string
  granted_at: Date
  expires_at: Date | null
}

function rowToAssignment(row: CapabilityRow): CapabilityAssignment {
  return {
    id: row.id,
    principalId: row.principal_id,
    capability: row.capability,
    grantedBy: row.granted_by,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
  }
}

export interface GrantCapabilityParams {
  principalId: string
  capability: string
  grantedBy: string
  expiresAt?: Date
}

export class PrincipalCapabilityRepository {
  constructor(
    private readonly pool: PrincipalStorePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  /**
   * Grants a capability to a principal. If already granted, this is a no-op.
   * Returns the existing or newly created assignment.
   */
  async grant(params: GrantCapabilityParams): Promise<CapabilityAssignment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT IGNORE INTO atc_capability_assignments
           (id, principal_id, capability, granted_by, granted_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(3), ?)`,
        [id, params.principalId, params.capability, params.grantedBy, params.expiresAt ?? null],
      )

      const [rows] = await conn.execute<CapabilityRow[]>(
        `SELECT * FROM atc_capability_assignments
         WHERE principal_id = ? AND capability = ? LIMIT 1`,
        [params.principalId, params.capability],
      )
      const row = rows[0]
      if (!row) throw new Error(`Capability assignment not found after insert: ${params.principalId}/${params.capability}`)
      this.telemetry?.increment('iam.capability_granted_total')
      return rowToAssignment(row)
    } finally {
      conn.release()
    }
  }

  /**
   * Revokes a capability from a principal. Returns true if the assignment existed.
   */
  async revoke(principalId: string, capability: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        'DELETE FROM atc_capability_assignments WHERE principal_id = ? AND capability = ?',
        [principalId, capability],
      )
      if (result.affectedRows > 0) {
        this.telemetry?.increment('iam.capability_revoked_total')
      }
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  /** Returns all non-expired capability assignments for a principal */
  async listByPrincipal(principalId: string): Promise<CapabilityAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CapabilityRow[]>(
        `SELECT * FROM atc_capability_assignments
         WHERE principal_id = ? AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY granted_at ASC`,
        [principalId],
      )
      return rows.map(rowToAssignment)
    } finally {
      conn.release()
    }
  }

  /** Checks if a principal has a specific capability granted (non-expired) */
  async has(principalId: string, capability: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<(RowDataPacket & { cnt: number })[]>(
        `SELECT COUNT(*) AS cnt FROM atc_capability_assignments
         WHERE principal_id = ? AND capability = ? AND (expires_at IS NULL OR expires_at > NOW(3))`,
        [principalId, capability],
      )
      return (rows[0]?.cnt ?? 0) > 0
    } finally {
      conn.release()
    }
  }
}
