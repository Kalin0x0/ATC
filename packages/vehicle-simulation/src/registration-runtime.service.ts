import type { AtcEventBus } from '@atc/events'
import type { RowDataPacket } from 'mysql2/promise'
import type {
  RegistrationRepository,
  AtcVehicleRegistration,
  CreateRegistrationParams,
} from './registration.repository.js'
import type { VehicleSimPool } from './pool.js'
import {
  VehicleRegistrationNotFoundError,
  VehicleRegistrationExpiredError,
} from './errors.js'

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
    status: row.status as AtcVehicleRegistration['status'],
    registeredAt: row.registered_at,
    expiresAt: row.expires_at,
    renewedAt: row.renewed_at,
    suspendedAt: row.suspended_at,
    revokedAt: row.revoked_at,
    revokedByPrincipalId: row.revoked_by_principal_id,
  }
}

export interface RegistrationRuntimeDeps {
  registrationRepo: RegistrationRepository
  pool: VehicleSimPool
  eventBus: AtcEventBus | undefined
}

export class RegistrationRuntimeService {
  private readonly registrationRepo: RegistrationRepository
  private readonly pool: VehicleSimPool
  private readonly eventBus: AtcEventBus | undefined

  constructor(deps: RegistrationRuntimeDeps) {
    this.registrationRepo = deps.registrationRepo
    this.pool             = deps.pool
    this.eventBus         = deps.eventBus
  }

  async register(params: CreateRegistrationParams): Promise<AtcVehicleRegistration> {
    return this.registrationRepo.create(params)
  }

  async validateRegistration(vehicleId: string): Promise<AtcVehicleRegistration> {
    const reg = await this.registrationRepo.findByVehicleId(vehicleId)
    if (!reg) throw new VehicleRegistrationNotFoundError(vehicleId)
    if (reg.status !== 'active') throw new VehicleRegistrationExpiredError(vehicleId)
    if (reg.expiresAt < new Date()) throw new VehicleRegistrationExpiredError(vehicleId)
    return reg
  }

  async renewRegistration(vehicleId: string, newExpiresAt: Date): Promise<AtcVehicleRegistration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_registrations
         SET expires_at = ?, renewed_at = NOW(3)
         WHERE vehicle_id = ?`,
        [newExpiresAt, vehicleId],
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

  async suspendRegistration(vehicleId: string): Promise<AtcVehicleRegistration> {
    return this.registrationRepo.updateStatus(vehicleId, 'suspended', {
      suspendedAt: new Date(),
    })
  }

  async revokeRegistration(
    vehicleId: string,
    revokedByPrincipalId: string,
  ): Promise<AtcVehicleRegistration> {
    return this.registrationRepo.updateStatus(vehicleId, 'revoked', {
      revokedAt: new Date(),
      revokedByPrincipalId,
    })
  }

  async processExpiredRegistrations(): Promise<void> {
    const expired = await this.registrationRepo.listExpired()
    for (const reg of expired) {
      await this.registrationRepo.updateStatus(reg.vehicleId, 'expired')
      this.eventBus?.emit('atc:vehicle:registration:expired', {
        vehicleId: reg.vehicleId,
        registrationId: reg.id,
        plate: reg.plate,
        ownerPrincipalId: reg.ownerPrincipalId,
      }).catch(() => undefined)
    }
  }
}
