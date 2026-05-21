import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeSustainmentPool } from './pool.js'
import { generateId } from './id.js'
import { MaintenanceNotFoundError, DuplicateMaintenanceError } from './errors.js'

export type AtcMaintenanceType = 'cleanup' | 'optimization' | 'repair' | 'upgrade' | 'custom'
export type AtcMaintenanceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface AtcAutonomousMaintenance {
  id: string
  maintenanceId: string
  maintenanceType: AtcMaintenanceType
  status: AtcMaintenanceStatus
  ownerServerId: string
  maintenanceNonce: string
  maintenanceData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateMaintenanceParams {
  maintenanceType: AtcMaintenanceType
  ownerServerId: string
  maintenanceNonce: string
  maintenanceData?: Record<string, unknown> | undefined
}

interface AutonomousMaintenanceRow extends RowDataPacket {
  id: string
  maintenance_id: string
  maintenance_type: string
  status: string
  owner_server_id: string
  maintenance_nonce: string
  maintenance_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AutonomousMaintenanceRow): AtcAutonomousMaintenance {
  let maintenanceData: Record<string, unknown> = {}
  if (row.maintenance_data) {
    try {
      maintenanceData = JSON.parse(row.maintenance_data) as Record<string, unknown>
    } catch {
      maintenanceData = {}
    }
  }
  return {
    id: row.id,
    maintenanceId: row.maintenance_id,
    maintenanceType: row.maintenance_type as AtcMaintenanceType,
    status: row.status as AtcMaintenanceStatus,
    ownerServerId: row.owner_server_id,
    maintenanceNonce: row.maintenance_nonce,
    maintenanceData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AutonomousMaintenanceRepository {
  constructor(private readonly pool: RuntimeSustainmentPool) {}

  async create(params: CreateMaintenanceParams): Promise<AtcAutonomousMaintenance> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const maintenanceId = generateId()
      const maintenanceDataJson = JSON.stringify(params.maintenanceData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_autonomous_maintenance
             (id, maintenance_id, maintenance_type, status, owner_server_id,
              maintenance_nonce, maintenance_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            maintenanceId,
            params.maintenanceType,
            params.ownerServerId,
            params.maintenanceNonce,
            maintenanceDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateMaintenanceError(params.maintenanceNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<AutonomousMaintenanceRow[]>(
        `SELECT id, maintenance_id, maintenance_type, status, owner_server_id,
                maintenance_nonce, maintenance_data, completed_at, created_at, updated_at
         FROM atc_autonomous_maintenance
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Autonomous maintenance not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcAutonomousMaintenance | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AutonomousMaintenanceRow[]>(
        `SELECT id, maintenance_id, maintenance_type, status, owner_server_id,
                maintenance_nonce, maintenance_data, completed_at, created_at, updated_at
         FROM atc_autonomous_maintenance
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcMaintenanceStatus,
    completedAt?: Date | undefined
  ): Promise<AtcAutonomousMaintenance> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<AutonomousMaintenanceRow[]>(
          `SELECT id, maintenance_id, maintenance_type, status, owner_server_id,
                  maintenance_nonce, maintenance_data, completed_at, created_at, updated_at
           FROM atc_autonomous_maintenance
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new MaintenanceNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_maintenance
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_maintenance
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<AutonomousMaintenanceRow[]>(
          `SELECT id, maintenance_id, maintenance_type, status, owner_server_id,
                  maintenance_nonce, maintenance_data, completed_at, created_at, updated_at
           FROM atc_autonomous_maintenance
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new MaintenanceNotFoundError(id)

        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_autonomous_maintenance
         WHERE status IN ('completed', 'failed', 'skipped')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
