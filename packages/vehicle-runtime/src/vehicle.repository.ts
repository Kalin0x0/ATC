import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcVehicle,
  AtcVehicleStatus,
  AtcVehicleCategory,
  AtcImpoundReason,
} from '@atc/shared-types'
import type { VehiclePool } from './pool.js'
import { generateId } from './id.js'
import { VehicleNotFoundError, VehicleImmutableError } from './errors.js'

interface VehicleRow extends RowDataPacket {
  id: string
  owner_id: string | null
  organization_id: string | null
  plate: string
  vin: string
  model: string
  category: string
  status: string
  fuel: number
  body_health: number
  engine_health: number
  mileage: number
  garage_id: string | null
  last_x: number | null
  last_y: number | null
  last_z: number | null
  last_heading: number | null
  is_locked: number
  is_engine_on: number
  color_primary: string | null
  color_secondary: string | null
  mod_hash: string | null
  created_at: Date
  updated_at: Date
}

function rowToVehicle(row: VehicleRow): AtcVehicle {
  return {
    id: row.id,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    plate: row.plate,
    vin: row.vin,
    model: row.model,
    category: row.category as AtcVehicleCategory,
    status: row.status as AtcVehicleStatus,
    fuel: row.fuel,
    bodyHealth: row.body_health,
    engineHealth: row.engine_health,
    mileage: row.mileage,
    garageId: row.garage_id,
    lastX: row.last_x,
    lastY: row.last_y,
    lastZ: row.last_z,
    lastHeading: row.last_heading,
    isLocked: row.is_locked === 1,
    isEngineOn: row.is_engine_on === 1,
    colorPrimary: row.color_primary,
    colorSecondary: row.color_secondary,
    modHash: row.mod_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcVehicleStatus, AtcVehicleStatus[]> = {
  stored:    ['spawned', 'impounded'],
  spawned:   ['active', 'stored', 'impounded', 'destroyed'],
  active:    ['spawned', 'stored', 'impounded', 'destroyed'],
  impounded: ['stored'],
  destroyed: ['stored'],
}

export interface CreateVehicleParams {
  ownerId?: string | null | undefined
  organizationId?: string | null | undefined
  plate: string
  vin: string
  model: string
  category?: AtcVehicleCategory | undefined
  garageId?: string | null | undefined
}

export interface TransitionVehicleParams {
  id: string
  newStatus: AtcVehicleStatus
  garageId?: string | null | undefined
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
  lastX?: number | null | undefined
  lastY?: number | null | undefined
  lastZ?: number | null | undefined
  lastHeading?: number | null | undefined
}

export interface RuntimeSnapshotParams {
  vehicleId: string
  x: number
  y: number
  z: number
  heading: number
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
  isLocked?: boolean | undefined
  isEngineOn?: boolean | undefined
  mileageDelta?: number | undefined
}

// Intentionally not re-exported to keep AtcImpoundReason import satisfied
void (null as unknown as AtcImpoundReason)

export class VehicleRepository {
  constructor(private readonly pool: VehiclePool) {}

  async create(params: CreateVehicleParams): Promise<AtcVehicle> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_vehicles
           (id, owner_id, organization_id, plate, vin, model, category,
            status, garage_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'stored', ?, NOW(3), NOW(3))`,
        [
          id,
          params.ownerId ?? null,
          params.organizationId ?? null,
          params.plate.toUpperCase(),
          params.vin.toUpperCase(),
          params.model,
          params.category ?? 'civilian',
          params.garageId ?? null,
        ],
      )
      const v = await this._findById(conn, id)
      if (!v) throw new VehicleNotFoundError(id)
      return v
    } finally {
      conn.release()
    }
  }

  async transition(params: TransitionVehicleParams): Promise<AtcVehicle> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<VehicleRow[]>(
          `SELECT * FROM atc_vehicles WHERE id = ? LIMIT 1 FOR UPDATE`,
          [params.id],
        )
        const current = rows[0] ? rowToVehicle(rows[0]) : null
        if (!current) throw new VehicleNotFoundError(params.id)

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(params.newStatus)) {
          throw new VehicleImmutableError(params.id, current.status, params.newStatus)
        }

        await conn.execute(
          `UPDATE atc_vehicles
           SET status        = ?,
               garage_id     = COALESCE(?, garage_id),
               fuel          = COALESCE(?, fuel),
               body_health   = COALESCE(?, body_health),
               engine_health = COALESCE(?, engine_health),
               last_x        = COALESCE(?, last_x),
               last_y        = COALESCE(?, last_y),
               last_z        = COALESCE(?, last_z),
               last_heading  = COALESCE(?, last_heading),
               updated_at    = NOW(3)
           WHERE id = ?`,
          [
            params.newStatus,
            params.garageId ?? null,
            params.fuel ?? null,
            params.bodyHealth ?? null,
            params.engineHealth ?? null,
            params.lastX ?? null,
            params.lastY ?? null,
            params.lastZ ?? null,
            params.lastHeading ?? null,
            params.id,
          ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, params.id)
      if (!updated) throw new VehicleNotFoundError(params.id)
      return updated
    } finally {
      conn.release()
    }
  }

  async updateRuntimeSnapshot(params: RuntimeSnapshotParams): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicles
         SET last_x        = ?,
             last_y        = ?,
             last_z        = ?,
             last_heading  = ?,
             fuel          = COALESCE(?, fuel),
             body_health   = COALESCE(?, body_health),
             engine_health = COALESCE(?, engine_health),
             is_locked     = COALESCE(?, is_locked),
             is_engine_on  = COALESCE(?, is_engine_on),
             mileage       = mileage + COALESCE(?, 0),
             updated_at    = NOW(3)
         WHERE id = ?`,
        [
          params.x, params.y, params.z, params.heading,
          params.fuel ?? null,
          params.bodyHealth ?? null,
          params.engineHealth ?? null,
          params.isLocked !== undefined ? (params.isLocked ? 1 : 0) : null,
          params.isEngineOn !== undefined ? (params.isEngineOn ? 1 : 0) : null,
          params.mileageDelta ?? null,
          params.vehicleId,
        ],
      )
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcVehicle | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findByPlate(plate: string): Promise<AtcVehicle | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VehicleRow[]>(
        `SELECT * FROM atc_vehicles WHERE plate = ? LIMIT 1`,
        [plate.toUpperCase()],
      )
      return rows[0] ? rowToVehicle(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByVin(vin: string): Promise<AtcVehicle | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VehicleRow[]>(
        `SELECT * FROM atc_vehicles WHERE vin = ? LIMIT 1`,
        [vin.toUpperCase()],
      )
      return rows[0] ? rowToVehicle(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByOwner(ownerId: string, status?: AtcVehicleStatus): Promise<AtcVehicle[]> {
    const conn = await this.pool.getConnection()
    try {
      const where = status ? 'AND status = ?' : ''
      const args: string[] = status ? [ownerId, status] : [ownerId]
      const [rows] = await conn.execute<VehicleRow[]>(
        `SELECT * FROM atc_vehicles WHERE owner_id = ? ${where} ORDER BY created_at DESC`,
        args,
      )
      return rows.map(rowToVehicle)
    } finally {
      conn.release()
    }
  }

  async listByOrganization(organizationId: string, status?: AtcVehicleStatus): Promise<AtcVehicle[]> {
    const conn = await this.pool.getConnection()
    try {
      const where = status ? 'AND status = ?' : ''
      const args: string[] = status ? [organizationId, status] : [organizationId]
      const [rows] = await conn.execute<VehicleRow[]>(
        `SELECT * FROM atc_vehicles WHERE organization_id = ? ${where} ORDER BY created_at DESC`,
        args,
      )
      return rows.map(rowToVehicle)
    } finally {
      conn.release()
    }
  }

  async listByGarage(garageId: string): Promise<AtcVehicle[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VehicleRow[]>(
        `SELECT * FROM atc_vehicles WHERE garage_id = ? AND status = 'stored' ORDER BY updated_at DESC`,
        [garageId],
      )
      return rows.map(rowToVehicle)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<VehiclePool['getConnection']>>,
    id: string,
  ): Promise<AtcVehicle | null> {
    const [rows] = await conn.execute<VehicleRow[]>(
      `SELECT * FROM atc_vehicles WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToVehicle(rows[0]) : null
  }
}
