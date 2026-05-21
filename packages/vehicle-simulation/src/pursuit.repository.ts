import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { VehicleSimPool } from './pool.js'
import { generateId } from './id.js'
import {
  PursuitNotFoundError,
  PursuitAlreadyActiveError,
  PursuitEndedError,
} from './errors.js'

export type AtcPursuitStatus = 'active' | 'ended' | 'escaped' | 'terminated'

export interface AtcVehiclePursuit {
  id: string
  vehicleRuntimeId: string
  suspectPrincipalId: string
  initiatingOfficerPrincipalId: string
  initiatingAgencyId: string | null
  status: AtcPursuitStatus
  pursuitNonce: string
  startLocationX: number | null
  startLocationY: number | null
  startLocationZ: number | null
  endLocationX: number | null
  endLocationY: number | null
  endLocationZ: number | null
  startedAt: Date
  endedAt: Date | null
  notes: string | null
}

interface PursuitRow extends RowDataPacket {
  id: string
  vehicle_runtime_id: string
  suspect_principal_id: string
  initiating_officer_principal_id: string
  initiating_agency_id: string | null
  status: string
  pursuit_nonce: string
  start_location_x: number | null
  start_location_y: number | null
  start_location_z: number | null
  end_location_x: number | null
  end_location_y: number | null
  end_location_z: number | null
  started_at: Date
  ended_at: Date | null
  notes: string | null
}

function rowToPursuit(row: PursuitRow): AtcVehiclePursuit {
  return {
    id: row.id,
    vehicleRuntimeId: row.vehicle_runtime_id,
    suspectPrincipalId: row.suspect_principal_id,
    initiatingOfficerPrincipalId: row.initiating_officer_principal_id,
    initiatingAgencyId: row.initiating_agency_id,
    status: row.status as AtcPursuitStatus,
    pursuitNonce: row.pursuit_nonce,
    startLocationX: row.start_location_x !== null ? Number(row.start_location_x) : null,
    startLocationY: row.start_location_y !== null ? Number(row.start_location_y) : null,
    startLocationZ: row.start_location_z !== null ? Number(row.start_location_z) : null,
    endLocationX: row.end_location_x !== null ? Number(row.end_location_x) : null,
    endLocationY: row.end_location_y !== null ? Number(row.end_location_y) : null,
    endLocationZ: row.end_location_z !== null ? Number(row.end_location_z) : null,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    notes: row.notes,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcPursuitStatus, AtcPursuitStatus[]> = {
  active: ['ended', 'escaped', 'terminated'],
  ended: [],
  escaped: [],
  terminated: [],
}

export interface CreatePursuitParams {
  vehicleRuntimeId: string
  suspectPrincipalId: string
  initiatingOfficerPrincipalId: string
  initiatingAgencyId?: string | null | undefined
  pursuitNonce: string
  startLocationX?: number | null | undefined
  startLocationY?: number | null | undefined
  startLocationZ?: number | null | undefined
  notes?: string | null | undefined
}

export interface TransitionPursuitOptions {
  endLocationX?: number | null | undefined
  endLocationY?: number | null | undefined
  endLocationZ?: number | null | undefined
  notes?: string | null | undefined
}

export class PursuitRepository {
  constructor(private readonly pool: VehicleSimPool) {}

  async create(params: CreatePursuitParams): Promise<AtcVehiclePursuit> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [existing] = await conn.execute<PursuitRow[]>(
          `SELECT id FROM atc_vehicle_pursuits
           WHERE vehicle_runtime_id = ? AND status = 'active'
           LIMIT 1 FOR UPDATE`,
          [params.vehicleRuntimeId],
        )
        if (existing.length > 0) throw new PursuitAlreadyActiveError(params.vehicleRuntimeId)

        try {
          await conn.execute(
            `INSERT INTO atc_vehicle_pursuits
               (id, vehicle_runtime_id, suspect_principal_id, initiating_officer_principal_id,
                initiating_agency_id, status, pursuit_nonce,
                start_location_x, start_location_y, start_location_z,
                notes, started_at)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, NOW(3))`,
            [
              id,
              params.vehicleRuntimeId,
              params.suspectPrincipalId,
              params.initiatingOfficerPrincipalId,
              params.initiatingAgencyId ?? null,
              params.pursuitNonce,
              params.startLocationX ?? null,
              params.startLocationY ?? null,
              params.startLocationZ ?? null,
              params.notes ?? null,
            ],
          )
        } catch (err: unknown) {
          if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
            throw new PursuitAlreadyActiveError(params.vehicleRuntimeId)
          }
          throw err
        }
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<PursuitRow[]>(
        `SELECT * FROM atc_vehicle_pursuits WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PursuitNotFoundError(id)
      return rowToPursuit(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcVehiclePursuit | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PursuitRow[]>(
        `SELECT * FROM atc_vehicle_pursuits WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToPursuit(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveByVehicle(vehicleRuntimeId: string): Promise<AtcVehiclePursuit | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PursuitRow[]>(
        `SELECT * FROM atc_vehicle_pursuits
         WHERE vehicle_runtime_id = ? AND status = 'active'
         ORDER BY started_at DESC LIMIT 1`,
        [vehicleRuntimeId],
      )
      return rows[0] ? rowToPursuit(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(
    id: string,
    status: AtcPursuitStatus,
    opts: TransitionPursuitOptions = {},
  ): Promise<AtcVehiclePursuit> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<PursuitRow[]>(
          `SELECT * FROM atc_vehicle_pursuits WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new PursuitNotFoundError(id)

        const current = rowToPursuit(rows[0])
        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (allowed.length === 0) throw new PursuitEndedError(id)
        if (!allowed.includes(status)) throw new PursuitEndedError(id)

        const isTerminal = status !== 'active'

        await conn.execute(
          `UPDATE atc_vehicle_pursuits
           SET status          = ?,
               ended_at        = ${isTerminal ? 'NOW(3)' : 'ended_at'},
               end_location_x  = COALESCE(?, end_location_x),
               end_location_y  = COALESCE(?, end_location_y),
               end_location_z  = COALESCE(?, end_location_z),
               notes           = COALESCE(?, notes)
           WHERE id = ?`,
          [
            status,
            opts.endLocationX ?? null,
            opts.endLocationY ?? null,
            opts.endLocationZ ?? null,
            opts.notes ?? null,
            id,
          ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<PursuitRow[]>(
        `SELECT * FROM atc_vehicle_pursuits WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PursuitNotFoundError(id)
      return rowToPursuit(rows[0])
    } finally {
      conn.release()
    }
  }

  async cleanStale(olderThanMinutes: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_vehicle_pursuits
         SET status   = 'terminated',
             ended_at = NOW(3)
         WHERE status = 'active'
           AND started_at < DATE_SUB(NOW(3), INTERVAL ? MINUTE)`,
        [olderThanMinutes],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }

  async listActivePursuits(): Promise<AtcVehiclePursuit[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PursuitRow[]>(
        `SELECT * FROM atc_vehicle_pursuits WHERE status = 'active' ORDER BY started_at DESC`,
      )
      return rows.map(rowToPursuit)
    } finally {
      conn.release()
    }
  }
}
