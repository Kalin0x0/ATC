import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RoleAssignment } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { PrincipalStorePool } from './pool.js'

interface RoleAssignmentRow extends RowDataPacket {
  id: string
  principal_id: string
  role_id: string
  assigned_by: string
  assigned_at: Date
  expires_at: Date | null
}

function rowToAssignment(row: RoleAssignmentRow): RoleAssignment {
  return {
    id: row.id,
    principalId: row.principal_id,
    roleId: row.role_id,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    expiresAt: row.expires_at,
  }
}

export interface AssignRoleParams {
  principalId: string
  roleId: string
  assignedBy: string
  expiresAt?: Date
}

export class RoleAssignmentRepository {
  constructor(
    private readonly pool: PrincipalStorePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  /**
   * Assigns a role to a principal. If the role is already assigned, this is a no-op.
   * Returns the existing or newly created assignment.
   */
  async assign(params: AssignRoleParams): Promise<RoleAssignment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT IGNORE INTO atc_role_assignments
           (id, principal_id, role_id, assigned_by, assigned_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(3), ?)`,
        [id, params.principalId, params.roleId, params.assignedBy, params.expiresAt ?? null],
      )

      // Fetch the actual record (may have pre-existed if INSERT IGNORE skipped)
      const [rows] = await conn.execute<RoleAssignmentRow[]>(
        `SELECT * FROM atc_role_assignments
         WHERE principal_id = ? AND role_id = ? LIMIT 1`,
        [params.principalId, params.roleId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Role assignment not found after insert: ${params.principalId}/${params.roleId}`)
      this.telemetry?.increment('iam.role_assigned_total')
      return rowToAssignment(row)
    } finally {
      conn.release()
    }
  }

  /**
   * Revokes a role assignment. Returns true if the assignment existed and was removed.
   */
  async revoke(principalId: string, roleId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        'DELETE FROM atc_role_assignments WHERE principal_id = ? AND role_id = ?',
        [principalId, roleId],
      )
      if (result.affectedRows > 0) {
        this.telemetry?.increment('iam.role_revoked_total')
      }
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  /** Returns all non-expired role assignments for a principal */
  async listByPrincipal(principalId: string): Promise<RoleAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RoleAssignmentRow[]>(
        `SELECT * FROM atc_role_assignments
         WHERE principal_id = ? AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY assigned_at ASC`,
        [principalId],
      )
      return rows.map(rowToAssignment)
    } finally {
      conn.release()
    }
  }

  /** Finds a specific assignment */
  async find(principalId: string, roleId: string): Promise<RoleAssignment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RoleAssignmentRow[]>(
        'SELECT * FROM atc_role_assignments WHERE principal_id = ? AND role_id = ? LIMIT 1',
        [principalId, roleId],
      )
      return rows[0] ? rowToAssignment(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
