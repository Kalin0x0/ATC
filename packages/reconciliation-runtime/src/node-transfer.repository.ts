import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReconciliationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { NodeTransferNotFoundError } from './errors.js'

export type AtcTransferStatus = 'initiated' | 'in_progress' | 'completed' | 'failed'

export interface AtcNodeTransfer {
  id: string
  transferId: string
  entityId: string
  fromServerId: string
  toServerId: string
  transferStatus: AtcTransferStatus
  transferData: Record<string, unknown>
  completedAt: Date | null
  failedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateNodeTransferParams {
  entityId: string
  fromServerId: string
  toServerId: string
  transferData?: Record<string, unknown> | undefined
}

interface NodeTransferRow extends RowDataPacket {
  id: string
  transfer_id: string
  entity_id: string
  from_server_id: string
  to_server_id: string
  transfer_status: string
  transfer_data: string | null
  completed_at: Date | null
  failed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: NodeTransferRow): AtcNodeTransfer {
  let transferData: Record<string, unknown> = {}
  if (row.transfer_data) {
    try {
      transferData = JSON.parse(row.transfer_data) as Record<string, unknown>
    } catch {
      transferData = {}
    }
  }
  return {
    id: row.id,
    transferId: row.transfer_id,
    entityId: row.entity_id,
    fromServerId: row.from_server_id,
    toServerId: row.to_server_id,
    transferStatus: row.transfer_status as AtcTransferStatus,
    transferData,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class NodeTransferRepository {
  constructor(private readonly pool: ReconciliationRuntimePool) {}

  async findById(transferId: string): Promise<AtcNodeTransfer | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NodeTransferRow[]>(
        `SELECT id, transfer_id, entity_id, from_server_id, to_server_id,
                transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at
         FROM atc_node_transfers
         WHERE transfer_id = ?
         LIMIT 1`,
        [transferId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async create(params: CreateNodeTransferParams): Promise<AtcNodeTransfer> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const transferId = generateId()
      const transferDataJson = params.transferData
        ? JSON.stringify(params.transferData)
        : null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_node_transfers
           (id, transfer_id, entity_id, from_server_id, to_server_id,
            transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'initiated', ?, NULL, NULL, NOW(3), NOW(3))`,
        [
          id,
          transferId,
          params.entityId,
          params.fromServerId,
          params.toServerId,
          transferDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<NodeTransferRow[]>(
        `SELECT id, transfer_id, entity_id, from_server_id, to_server_id,
                transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at
         FROM atc_node_transfers
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Node transfer not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async transition(transferId: string, status: AtcTransferStatus): Promise<AtcNodeTransfer> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<NodeTransferRow[]>(
          `SELECT id, transfer_id, entity_id, from_server_id, to_server_id,
                  transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at
           FROM atc_node_transfers
           WHERE transfer_id = ?
           LIMIT 1
           FOR UPDATE`,
          [transferId]
        )
        if (!rows[0]) throw new NodeTransferNotFoundError(transferId)

        let sql: string
        const binds: (string | number | boolean | null)[] = [status]

        if (status === 'completed') {
          sql = `UPDATE atc_node_transfers
                 SET transfer_status = ?, completed_at = NOW(3), updated_at = NOW(3)
                 WHERE transfer_id = ?`
        } else if (status === 'failed') {
          sql = `UPDATE atc_node_transfers
                 SET transfer_status = ?, failed_at = NOW(3), updated_at = NOW(3)
                 WHERE transfer_id = ?`
        } else {
          sql = `UPDATE atc_node_transfers
                 SET transfer_status = ?, updated_at = NOW(3)
                 WHERE transfer_id = ?`
        }
        binds.push(transferId)

        await conn.execute<ResultSetHeader>(sql, binds)

        const [updated] = await conn.execute<NodeTransferRow[]>(
          `SELECT id, transfer_id, entity_id, from_server_id, to_server_id,
                  transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at
           FROM atc_node_transfers
           WHERE transfer_id = ?
           LIMIT 1`,
          [transferId]
        )
        if (!updated[0]) throw new NodeTransferNotFoundError(transferId)

        await conn.commit()
        return mapRow(updated[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async listByEntityId(entityId: string): Promise<AtcNodeTransfer[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NodeTransferRow[]>(
        `SELECT id, transfer_id, entity_id, from_server_id, to_server_id,
                transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at
         FROM atc_node_transfers
         WHERE entity_id = ?
         ORDER BY created_at ASC`,
        [entityId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcNodeTransfer[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NodeTransferRow[]>(
        `SELECT id, transfer_id, entity_id, from_server_id, to_server_id,
                transfer_status, transfer_data, completed_at, failed_at, created_at, updated_at
         FROM atc_node_transfers
         WHERE transfer_status IN ('initiated', 'in_progress')
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
