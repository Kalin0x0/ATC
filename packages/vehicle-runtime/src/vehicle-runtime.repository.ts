import type { RowDataPacket } from 'mysql2/promise'
import type { AtcVehicleRuntime } from '@atc/shared-types'
import type { VehiclePool } from './pool.js'
import { generateId } from './id.js'
import { VehicleNotFoundError, VehicleAlreadySpawnedError } from './errors.js'

interface RuntimeRow extends RowDataPacket {
  id: string
  vehicle_id: string
  spawned_by_principal_id: string
  net_id: number | null
  server_handle: number | null
  x: number
  y: number
  z: number
  heading: number
  fuel: number
  body_health: number
  engine_health: number
  is_locked: number
  is_engine_on: number
  last_heartbeat_at: Date
  expires_at: Date | null
  spawned_at: Date
  updated_at: Date
}

function rowToRuntime(row: RuntimeRow): AtcVehicleRuntime {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    spawnedByPrincipalId: row.spawned_by_principal_id,
    netId: row.net_id,
    serverHandle: row.server_handle,
    x: row.x,
    y: row.y,
    z: row.z,
    heading: row.heading,
    fuel: row.fuel,
    bodyHealth: row.body_health,
    engineHealth: row.engine_health,
    isLocked: row.is_locked === 1,
    isEngineOn: row.is_engine_on === 1,
    lastHeartbeatAt: row.last_heartbeat_at,
    expiresAt: row.expires_at,
    spawnedAt: row.spawned_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateRuntimeParams {
  vehicleId: string
  spawnedByPrincipalId: string
  x: number
  y: number
  z: number
  heading?: number | undefined
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
  expiresInSeconds?: number | undefined
}

export interface UpdateRuntimeParams {
  vehicleId: string
  netId?: number | null | undefined
  serverHandle?: number | null | undefined
  x?: number | undefined
  y?: number | undefined
  z?: number | undefined
  heading?: number | undefined
  fuel?: number | undefined
  bodyHealth?: number | undefined
  engineHealth?: number | undefined
  isLocked?: boolean | undefined
  isEngineOn?: boolean | undefined
}

export class VehicleRuntimeRepository {
  constructor(private readonly pool: VehiclePool) {}

  async create(params: CreateRuntimeParams): Promise<AtcVehicleRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_vehicle_runtime
             (id, vehicle_id, spawned_by_principal_id, x, y, z, heading,
              fuel, body_health, engine_health,
              expires_at, spawned_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ${params.expiresInSeconds ? `DATE_ADD(NOW(3), INTERVAL ? SECOND)` : 'NULL'},
             NOW(3), NOW(3))`,
          params.expiresInSeconds
            ? [
                id, params.vehicleId, params.spawnedByPrincipalId,
                params.x, params.y, params.z, params.heading ?? 0,
                params.fuel ?? 100, params.bodyHealth ?? 1000, params.engineHealth ?? 1000,
                params.expiresInSeconds,
              ]
            : [
                id, params.vehicleId, params.spawnedByPrincipalId,
                params.x, params.y, params.z, params.heading ?? 0,
                params.fuel ?? 100, params.bodyHealth ?? 1000, params.engineHealth ?? 1000,
              ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new VehicleAlreadySpawnedError(params.vehicleId)
        }
        throw err
      }
      const runtime = await this._findByVehicle(conn, params.vehicleId)
      if (!runtime) throw new VehicleNotFoundError(params.vehicleId)
      return runtime
    } finally {
      conn.release()
    }
  }

  async update(params: UpdateRuntimeParams): Promise<AtcVehicleRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_vehicle_runtime
         SET net_id        = COALESCE(?, net_id),
             server_handle = COALESCE(?, server_handle),
             x             = COALESCE(?, x),
             y             = COALESCE(?, y),
             z             = COALESCE(?, z),
             heading       = COALESCE(?, heading),
             fuel          = COALESCE(?, fuel),
             body_health   = COALESCE(?, body_health),
             engine_health = COALESCE(?, engine_health),
             is_locked     = COALESCE(?, is_locked),
             is_engine_on  = COALESCE(?, is_engine_on),
             last_heartbeat_at = NOW(3),
             updated_at    = NOW(3)
         WHERE vehicle_id = ?`,
        [
          params.netId !== undefined ? params.netId : null,
          params.serverHandle !== undefined ? params.serverHandle : null,
          params.x ?? null,
          params.y ?? null,
          params.z ?? null,
          params.heading ?? null,
          params.fuel ?? null,
          params.bodyHealth ?? null,
          params.engineHealth ?? null,
          params.isLocked !== undefined ? (params.isLocked ? 1 : 0) : null,
          params.isEngineOn !== undefined ? (params.isEngineOn ? 1 : 0) : null,
          params.vehicleId,
        ],
      )
      return this._findByVehicle(conn, params.vehicleId)
    } finally {
      conn.release()
    }
  }

  async delete(vehicleId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `DELETE FROM atc_vehicle_runtime WHERE vehicle_id = ?`,
        [vehicleId],
      )
    } finally {
      conn.release()
    }
  }

  async findByVehicle(vehicleId: string): Promise<AtcVehicleRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findByVehicle(conn, vehicleId)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcVehicleRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeRow[]>(
        `SELECT * FROM atc_vehicle_runtime ORDER BY spawned_at DESC`,
      )
      return rows.map(rowToRuntime)
    } finally {
      conn.release()
    }
  }

  private async _findByVehicle(
    conn: Awaited<ReturnType<VehiclePool['getConnection']>>,
    vehicleId: string,
  ): Promise<AtcVehicleRuntime | null> {
    const [rows] = await conn.execute<RuntimeRow[]>(
      `SELECT * FROM atc_vehicle_runtime WHERE vehicle_id = ? LIMIT 1`,
      [vehicleId],
    )
    return rows[0] ? rowToRuntime(rows[0]) : null
  }
}
