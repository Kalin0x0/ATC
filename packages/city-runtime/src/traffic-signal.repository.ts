import type { RowDataPacket } from 'mysql2/promise'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { TrafficSignalNotFoundError } from './errors.js'

export type AtcSignalState = 'green' | 'yellow' | 'red' | 'flashing' | 'offline'

export interface AtcTrafficSignal {
  id: string
  signalId: string
  signalName: string
  state: AtcSignalState
  positionX: number | null
  positionY: number | null
  positionZ: number | null
  intersectionId: string | null
  cycleDurationSeconds: number
  lastChangedAt: Date
  changedByPrincipalId: string | null
  createdAt: Date
  updatedAt: Date
}

interface SignalRow extends RowDataPacket {
  id: string
  signal_id: string
  signal_name: string
  state: string
  position_x: number | null
  position_y: number | null
  position_z: number | null
  intersection_id: string | null
  cycle_duration_seconds: number
  last_changed_at: Date
  changed_by_principal_id: string | null
  created_at: Date
  updated_at: Date
}

function rowToSignal(row: SignalRow): AtcTrafficSignal {
  return {
    id: row.id,
    signalId: row.signal_id,
    signalName: row.signal_name,
    state: row.state as AtcSignalState,
    positionX: row.position_x !== null ? Number(row.position_x) : null,
    positionY: row.position_y !== null ? Number(row.position_y) : null,
    positionZ: row.position_z !== null ? Number(row.position_z) : null,
    intersectionId: row.intersection_id,
    cycleDurationSeconds: Number(row.cycle_duration_seconds),
    lastChangedAt: row.last_changed_at,
    changedByPrincipalId: row.changed_by_principal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertSignalOptions {
  positionX?: number | null | undefined
  positionY?: number | null | undefined
  positionZ?: number | null | undefined
  intersectionId?: string | null | undefined
  cycleDurationSeconds?: number | undefined
  changedByPrincipalId?: string | null | undefined
}

export class TrafficSignalRepository {
  constructor(private readonly pool: CityRuntimePool) {}

  async findBySignalId(signalId: string): Promise<AtcTrafficSignal | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SignalRow[]>(
        `SELECT * FROM atc_traffic_signals WHERE signal_id = ? LIMIT 1`,
        [signalId],
      )
      return rows[0] ? rowToSignal(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async upsertState(
    signalId: string,
    signalName: string,
    state: AtcSignalState,
    opts: UpsertSignalOptions = {},
  ): Promise<AtcTrafficSignal> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_traffic_signals
           (id, signal_id, signal_name, state,
            position_x, position_y, position_z,
            intersection_id, cycle_duration_seconds,
            last_changed_at, changed_by_principal_id,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           signal_name              = VALUES(signal_name),
           state                    = VALUES(state),
           position_x               = COALESCE(VALUES(position_x), position_x),
           position_y               = COALESCE(VALUES(position_y), position_y),
           position_z               = COALESCE(VALUES(position_z), position_z),
           intersection_id          = COALESCE(VALUES(intersection_id), intersection_id),
           cycle_duration_seconds   = COALESCE(VALUES(cycle_duration_seconds), cycle_duration_seconds),
           last_changed_at          = NOW(3),
           changed_by_principal_id  = COALESCE(VALUES(changed_by_principal_id), changed_by_principal_id),
           updated_at               = NOW(3)`,
        [
          id,
          signalId,
          signalName,
          state,
          opts.positionX ?? null,
          opts.positionY ?? null,
          opts.positionZ ?? null,
          opts.intersectionId ?? null,
          opts.cycleDurationSeconds ?? 30,
          opts.changedByPrincipalId ?? null,
        ],
      )
      const [rows] = await conn.execute<SignalRow[]>(
        `SELECT * FROM atc_traffic_signals WHERE signal_id = ? LIMIT 1`,
        [signalId],
      )
      if (!rows[0]) throw new TrafficSignalNotFoundError(signalId)
      return rowToSignal(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByIntersection(intersectionId: string): Promise<AtcTrafficSignal[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SignalRow[]>(
        `SELECT * FROM atc_traffic_signals
         WHERE intersection_id = ?
         ORDER BY signal_name ASC`,
        [intersectionId],
      )
      return rows.map(rowToSignal)
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcTrafficSignal[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<SignalRow[]>(
        `SELECT * FROM atc_traffic_signals ORDER BY signal_name ASC`,
      )
      return rows.map(rowToSignal)
    } finally {
      conn.release()
    }
  }
}
