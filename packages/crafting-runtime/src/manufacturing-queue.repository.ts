import type { RowDataPacket } from 'mysql2/promise'
import type { CraftingRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { ManufacturingQueueNotFoundError } from './errors.js'

export type AtcQueueStatus = 'idle' | 'running' | 'paused' | 'offline'

export interface AtcManufacturingQueue {
  id: string
  queueId: string
  stationId: string
  stationType: string
  status: AtcQueueStatus
  currentJobId: string | null
  operatorPrincipalId: string | null
  createdAt: Date
  updatedAt: Date
}

interface ManufacturingQueueRow extends RowDataPacket {
  id: string
  queue_id: string
  station_id: string
  station_type: string
  status: string
  current_job_id: string | null
  operator_principal_id: string | null
  created_at: Date
  updated_at: Date
}

function rowToQueue(row: ManufacturingQueueRow): AtcManufacturingQueue {
  return {
    id: row.id,
    queueId: row.queue_id,
    stationId: row.station_id,
    stationType: row.station_type,
    status: row.status as AtcQueueStatus,
    currentJobId: row.current_job_id,
    operatorPrincipalId: row.operator_principal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ManufacturingQueueRepository {
  constructor(private readonly pool: CraftingRuntimePool) {}

  async findByStationId(stationId: string): Promise<AtcManufacturingQueue | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ManufacturingQueueRow[]>(
        'SELECT * FROM atc_manufacturing_queues WHERE station_id = ? LIMIT 1',
        [stationId],
      )
      return rows[0] ? rowToQueue(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async upsert(stationId: string, stationType: string): Promise<AtcManufacturingQueue> {
    const id = generateId()
    const queueId = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_manufacturing_queues
           (id, queue_id, station_id, station_type, status, current_job_id, operator_principal_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'idle', NULL, NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           station_type = VALUES(station_type),
           updated_at   = NOW(3)`,
        [id, queueId, stationId, stationType],
      )
      const [rows] = await conn.execute<ManufacturingQueueRow[]>(
        'SELECT * FROM atc_manufacturing_queues WHERE station_id = ? LIMIT 1',
        [stationId],
      )
      if (!rows[0]) throw new ManufacturingQueueNotFoundError(stationId)
      return rowToQueue(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    stationId: string,
    status: AtcQueueStatus,
    currentJobId?: string | null,
    operatorPrincipalId?: string | null,
  ): Promise<AtcManufacturingQueue> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ManufacturingQueueRow[]>(
          'SELECT * FROM atc_manufacturing_queues WHERE station_id = ? FOR UPDATE',
          [stationId],
        )
        if (!rows[0]) throw new ManufacturingQueueNotFoundError(stationId)

        const binds: (string | number | boolean | null)[] = [status]

        const setClauses = ['status = ?', 'updated_at = NOW(3)']

        if (currentJobId !== undefined) {
          setClauses.push('current_job_id = ?')
          binds.push(currentJobId)
        }

        if (operatorPrincipalId !== undefined) {
          setClauses.push('operator_principal_id = ?')
          binds.push(operatorPrincipalId)
        }

        binds.push(stationId)

        await conn.execute(
          `UPDATE atc_manufacturing_queues SET ${setClauses.join(', ')} WHERE station_id = ?`,
          binds,
        )

        const [updated] = await conn.execute<ManufacturingQueueRow[]>(
          'SELECT * FROM atc_manufacturing_queues WHERE station_id = ? LIMIT 1',
          [stationId],
        )
        if (!updated[0]) throw new ManufacturingQueueNotFoundError(stationId)

        await conn.commit()
        return rowToQueue(updated[0])
      } catch (err) {
        try {
          await conn.rollback()
        } catch {
        }
        throw err
      }
    } finally {
      conn.release()
    }
  }
}
