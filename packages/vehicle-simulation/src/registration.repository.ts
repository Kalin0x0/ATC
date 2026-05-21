import type { RowDataPacket } from 'mysql2/promise'
import type { VehicleSimPool } from './pool.js'
import { generateId } from './id.js'
import {
  VehicleRegistrationNotFoundError,
  VehicleRegistrationAlreadyActiveError,
} from './errors.js'

export type AtcRegistrationStatus = 'active' | 'expired' | 'suspended' | 'revoked'

export interface AtcVehicleRegistration {
  id: string
  vehicleId: string
  ownerPrincipalId: string
  plate: string
  status: AtcRegistrationStatus
  registeredAt: Date
  expiresAt: Date
  renewedAt: Date | null
  suspendedAt: Date | null
  revokedAt: Date | null
  revokedByPrincipalId: string | null
}

interface RegistrationRow extends RowDataPacket {
  id: string
  vehicle_id: string
  owner_principal_id: string
  plate: string
  status: string
  registered_at: Date
  expires_at: Date
  renewed_at: Date | null
  suspended_at: Date | null
  revoked_at: Date | null
  revoked_by_principal_id: string | null
}

function rowToRegistration(row: RegistrationRow): AtcVehicleRegistration {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    ownerPrincipalId: row.owner_principal_id,
    plate: row.plate,
    status: row.status as AtcRegistrationStatus,
    registeredAt: row.registered_at,
    expiresAt: row.expires_at,
    renewedAt: row.renewed_at,
    suspendedAt: row.suspended_at,
    revokedAt: row.revoked_at,
    revokedByPrincipalId: row.revoked_by_principal_id,
  }
}

export interface CreateRegistrationParams {
  vehicleId: string
  ownerPrincipalId: string
  plate: string
  expiresAt: Date
}

export interface UpdateStatusOptions {
  renewedAt?: Date | null | undefined
  suspendedAt?: Date | null | undefined
  revokedAt?: Date | null | undefined
  revokedByPrincipalId?: string | null | undefined
}

export class RegistrationRepository {
  constructor(private readonly pool: VehicleSimPool) {}

  async create(params: CreateRegistrationParams): Promise<AtcVehicleRegistration> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_vehicle_registrations
             (id, vehicle_id, owner_principal_id, plate, status, registered_at, expires_at)
           VALUES (?, ?, ?, ?, 'active', NOW(3), ?)`,
          [id, params.vehicleId, params.ownerPrincipalId, params.plate, params.expiresAt],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new VehicleRegistrationAlreadyActiveError(params.vehicleId)
        }
        throw err
      }
      const [rows] = await conn.execute<RegistrationRow[]>(
        `SELECT * FROM atc_vehicle_registrations WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new VehicleRegistrationNotFoundError(params.vehicleId)
      return rowToRegistration(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByVehicleId(vehicleId: string): Promise<AtcVehicleRegistration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegistrationRow[]>(
        `SELECT * FROM atc_vehicle_registrations WHERE vehicle_id = ? ORDER BY registered_at DESC LIMIT 1`,
        [vehicleId],
      )
      return rows[0] ? rowToRegistration(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByPlate(plate: string): Promise<AtcVehicleRegistration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegistrationRow[]>(
        `SELECT * FROM atc_vehicle_registrations WHERE plate = ? ORDER BY registered_at DESC LIMIT 1`,
        [plate],
      )
      return rows[0] ? rowToRegistration(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    vehicleId: string,
    status: AtcRegistrationStatus,
    opts: UpdateStatusOptions = {},
  ): Promise<AtcVehicleRegistration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_registrations
         SET status                  = ?,
             renewed_at              = COALESCE(?, renewed_at),
             suspended_at            = COALESCE(?, suspended_at),
             revoked_at              = COALESCE(?, revoked_at),
             revoked_by_principal_id = COALESCE(?, revoked_by_principal_id)
         WHERE vehicle_id = ?`,
        [
          status,
          opts.renewedAt ?? null,
          opts.suspendedAt ?? null,
          opts.revokedAt ?? null,
          opts.revokedByPrincipalId ?? null,
          vehicleId,
        ],
      )
      const [rows] = await conn.execute<RegistrationRow[]>(
        `SELECT * FROM atc_vehicle_registrations WHERE vehicle_id = ? ORDER BY registered_at DESC LIMIT 1`,
        [vehicleId],
      )
      if (!rows[0]) throw new VehicleRegistrationNotFoundError(vehicleId)
      return rowToRegistration(rows[0])
    } finally {
      conn.release()
    }
  }

  async listExpired(): Promise<AtcVehicleRegistration[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegistrationRow[]>(
        `SELECT * FROM atc_vehicle_registrations
         WHERE status = 'active' AND expires_at < NOW(3)
         ORDER BY expires_at ASC`,
      )
      return rows.map(rowToRegistration)
    } finally {
      conn.release()
    }
  }

  async listByOwner(ownerPrincipalId: string): Promise<AtcVehicleRegistration[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RegistrationRow[]>(
        `SELECT * FROM atc_vehicle_registrations
         WHERE owner_principal_id = ?
         ORDER BY registered_at DESC`,
        [ownerPrincipalId],
      )
      return rows.map(rowToRegistration)
    } finally {
      conn.release()
    }
  }
}
