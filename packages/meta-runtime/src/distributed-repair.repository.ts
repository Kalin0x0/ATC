import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MetaRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { RepairNotFoundError, DuplicateRepairError } from './errors.js'

export type AtcRepairType = 'data_repair' | 'state_sync' | 'schema_fix' | 'consistency_check' | 'index_rebuild' | 'custom'
export type AtcRepairStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcDistributedRepair {
  id: string
  repairId: string
  repairType: AtcRepairType
  status: AtcRepairStatus
  ownerServerId: string
  targetNode: string
  repairNonce: string
  repairData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDistributedRepairParams {
  repairType: AtcRepairType
  ownerServerId: string
  targetNode: string
  repairNonce: string
  repairData?: Record<string, unknown> | undefined
}

interface DistributedRepairRow extends RowDataPacket {
  id: string
  repair_id: string
  repair_type: string
  status: string
  owner_server_id: string
  target_node: string
  repair_nonce: string
  repair_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DistributedRepairRow): AtcDistributedRepair {
  let repairData: Record<string, unknown> = {}
  if (row.repair_data) {
    try { repairData = JSON.parse(row.repair_data) as Record<string, unknown> } catch { repairData = {} }
  }
  return {
    id: row.id,
    repairId: row.repair_id,
    repairType: row.repair_type as AtcRepairType,
    status: row.status as AtcRepairStatus,
    ownerServerId: row.owner_server_id,
    targetNode: row.target_node,
    repairNonce: row.repair_nonce,
    repairData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DistributedRepairRepository {
  constructor(private readonly pool: MetaRuntimePool) {}

  async create(params: CreateDistributedRepairParams): Promise<AtcDistributedRepair> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const repairId = generateId()
      const repairDataJson = JSON.stringify(params.repairData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_distributed_repair
             (id, repair_id, repair_type, status, owner_server_id, target_node, repair_nonce,
              repair_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, repairId, params.repairType, params.ownerServerId,
           params.targetNode, params.repairNonce, repairDataJson] as string[],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateRepairError(params.repairNonce)
        throw err
      }

      const [rows] = await conn.execute<DistributedRepairRow[]>(
        `SELECT id, repair_id, repair_type, status, owner_server_id, target_node, repair_nonce,
                repair_data, completed_at, created_at, updated_at
         FROM atc_distributed_repair WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new RepairNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDistributedRepair | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DistributedRepairRow[]>(
        `SELECT id, repair_id, repair_type, status, owner_server_id, target_node, repair_nonce,
                repair_data, completed_at, created_at, updated_at
         FROM atc_distributed_repair WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcRepairStatus, completedAt?: Date | undefined): Promise<AtcDistributedRepair> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DistributedRepairRow[]>(
          `SELECT id FROM atc_distributed_repair WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new RepairNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_distributed_repair SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[],
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_distributed_repair SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id],
          )
        }

        const [rows] = await conn.execute<DistributedRepairRow[]>(
          `SELECT id, repair_id, repair_type, status, owner_server_id, target_node, repair_nonce,
                  repair_data, completed_at, created_at, updated_at
           FROM atc_distributed_repair WHERE id = ? LIMIT 1`,
          [id],
        )
        const row = rows[0]
        if (!row) throw new RepairNotFoundError(id)
        await conn.commit()
        return mapRow(row)
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
        `DELETE FROM atc_distributed_repair
         WHERE status IN ('completed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
