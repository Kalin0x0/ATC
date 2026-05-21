import type { RowDataPacket } from 'mysql2/promise'
import type { AtcVehicleFleetAssignment } from '@atc/shared-types'
import type { VehiclePool } from './pool.js'
import { generateId } from './id.js'
import { FleetAssignmentConflictError, FleetAssignmentNotFoundError } from './errors.js'

interface FleetRow extends RowDataPacket {
  id: string
  vehicle_id: string
  organization_id: string | null
  principal_id: string | null
  assigned_by_principal_id: string
  role: string
  expires_at: Date | null
  unassigned_at: Date | null
  unassigned_by_principal_id: string | null
  assigned_at: Date
}

function rowToAssignment(row: FleetRow): AtcVehicleFleetAssignment {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    organizationId: row.organization_id,
    principalId: row.principal_id,
    assignedByPrincipalId: row.assigned_by_principal_id,
    role: row.role,
    expiresAt: row.expires_at,
    unassignedAt: row.unassigned_at,
    unassignedByPrincipalId: row.unassigned_by_principal_id,
    assignedAt: row.assigned_at,
  }
}

export interface CreateFleetAssignmentParams {
  vehicleId: string
  organizationId?: string | null | undefined
  principalId?: string | null | undefined
  assignedByPrincipalId: string
  role?: string | undefined
  expiresInSeconds?: number | undefined
}

export class FleetRepository {
  constructor(private readonly pool: VehiclePool) {}

  async assign(params: CreateFleetAssignmentParams): Promise<AtcVehicleFleetAssignment> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        // Lock any existing active assignment to prevent races
        const [existing] = await conn.execute<FleetRow[]>(
          `SELECT * FROM atc_vehicle_fleet_assignments
           WHERE vehicle_id = ? AND unassigned_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [params.vehicleId],
        )
        if (existing.length > 0) {
          throw new FleetAssignmentConflictError(params.vehicleId)
        }

        await conn.execute(
          `INSERT INTO atc_vehicle_fleet_assignments
             (id, vehicle_id, organization_id, principal_id,
              assigned_by_principal_id, role, expires_at, assigned_at)
           VALUES (?, ?, ?, ?, ?, ?,
             ${params.expiresInSeconds ? `DATE_ADD(NOW(3), INTERVAL ? SECOND)` : 'NULL'},
             NOW(3))`,
          params.expiresInSeconds
            ? [
                id, params.vehicleId, params.organizationId ?? null, params.principalId ?? null,
                params.assignedByPrincipalId, params.role ?? 'general', params.expiresInSeconds,
              ]
            : [
                id, params.vehicleId, params.organizationId ?? null, params.principalId ?? null,
                params.assignedByPrincipalId, params.role ?? 'general',
              ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<FleetRow[]>(
        `SELECT * FROM atc_vehicle_fleet_assignments WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new FleetAssignmentNotFoundError(id)
      return rowToAssignment(rows[0])
    } finally {
      conn.release()
    }
  }

  async unassign(assignmentId: string, unassignedByPrincipalId: string): Promise<AtcVehicleFleetAssignment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<FleetRow[]>(
          `SELECT * FROM atc_vehicle_fleet_assignments WHERE id = ? LIMIT 1 FOR UPDATE`,
          [assignmentId],
        )
        if (!rows[0]) throw new FleetAssignmentNotFoundError(assignmentId)

        await conn.execute(
          `UPDATE atc_vehicle_fleet_assignments
           SET unassigned_at = NOW(3), unassigned_by_principal_id = ?
           WHERE id = ?`,
          [unassignedByPrincipalId, assignmentId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<FleetRow[]>(
        `SELECT * FROM atc_vehicle_fleet_assignments WHERE id = ? LIMIT 1`,
        [assignmentId],
      )
      if (!rows[0]) throw new FleetAssignmentNotFoundError(assignmentId)
      return rowToAssignment(rows[0])
    } finally {
      conn.release()
    }
  }

  async findActiveForVehicle(vehicleId: string): Promise<AtcVehicleFleetAssignment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FleetRow[]>(
        `SELECT * FROM atc_vehicle_fleet_assignments
         WHERE vehicle_id = ? AND unassigned_at IS NULL
         ORDER BY assigned_at DESC LIMIT 1`,
        [vehicleId],
      )
      return rows[0] ? rowToAssignment(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveForPrincipal(principalId: string): Promise<AtcVehicleFleetAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FleetRow[]>(
        `SELECT * FROM atc_vehicle_fleet_assignments
         WHERE principal_id = ? AND unassigned_at IS NULL
         ORDER BY assigned_at DESC`,
        [principalId],
      )
      return rows.map(rowToAssignment)
    } finally {
      conn.release()
    }
  }

  async listActiveForOrganization(organizationId: string): Promise<AtcVehicleFleetAssignment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FleetRow[]>(
        `SELECT * FROM atc_vehicle_fleet_assignments
         WHERE organization_id = ? AND unassigned_at IS NULL
         ORDER BY assigned_at DESC`,
        [organizationId],
      )
      return rows.map(rowToAssignment)
    } finally {
      conn.release()
    }
  }
}
