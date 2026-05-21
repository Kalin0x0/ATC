import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SecurityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateContainmentError, ContainmentNotFoundError } from './errors.js'

export type AtcContainmentType = 'block' | 'throttle' | 'isolate' | 'terminate' | 'custom'

export type AtcContainmentStatus = 'active' | 'completed' | 'failed' | 'released'

export interface AtcThreatContainment {
  id: string
  containmentId: string
  entityId: string
  containmentType: AtcContainmentType
  status: AtcContainmentStatus
  ownerServerId: string
  containmentNonce: string
  completedAt: Date | null
  containmentData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateContainmentParams {
  entityId: string
  containmentType: AtcContainmentType
  ownerServerId: string
  containmentNonce: string
  containmentData?: Record<string, unknown> | undefined
}

interface ContainmentRow extends RowDataPacket {
  id: string
  containment_id: string
  entity_id: string
  containment_type: AtcContainmentType
  status: AtcContainmentStatus
  owner_server_id: string
  containment_nonce: string
  completed_at: Date | null
  containment_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: ContainmentRow): AtcThreatContainment {
  return {
    id: row.id,
    containmentId: row.containment_id,
    entityId: row.entity_id,
    containmentType: row.containment_type,
    status: row.status,
    ownerServerId: row.owner_server_id,
    containmentNonce: row.containment_nonce,
    completedAt: row.completed_at,
    containmentData: typeof row.containment_data === 'string' ? JSON.parse(row.containment_data) : row.containment_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ThreatContainmentRepository {
  constructor(private pool: SecurityRuntimePool) {}

  async create(params: CreateContainmentParams): Promise<AtcThreatContainment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const containmentId = generateId()
      const containmentData = JSON.stringify(params.containmentData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_threat_containment
            (id, containment_id, entity_id, containment_type, status, owner_server_id, containment_nonce, completed_at, containment_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, NULL, ?, NOW(3), NOW(3))`,
          [id, containmentId, params.entityId, params.containmentType, params.ownerServerId, params.containmentNonce, containmentData],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateContainmentError(params.containmentNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<ContainmentRow[]>(
        `SELECT * FROM atc_threat_containment WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new ContainmentNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcThreatContainment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ContainmentRow[]>(
        `SELECT * FROM atc_threat_containment WHERE id = ?`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcContainmentStatus, completedAt?: Date): Promise<AtcThreatContainment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [locked] = await conn.execute<ContainmentRow[]>(
          `SELECT * FROM atc_threat_containment WHERE id = ? FOR UPDATE`,
          [id],
        )
        if (!locked[0]) {
          throw new ContainmentNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_threat_containment SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, completedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<ContainmentRow[]>(
        `SELECT * FROM atc_threat_containment WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new ContainmentNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_threat_containment WHERE status IN ('completed', 'released', 'failed') AND updated_at < ?`,
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
