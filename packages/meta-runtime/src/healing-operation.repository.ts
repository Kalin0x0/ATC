import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MetaRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { HealingNotFoundError, DuplicateHealingError } from './errors.js'

export type AtcHealingType = 'restart' | 'failover' | 'rollback' | 'rebalance' | 'patch' | 'custom'
export type AtcHealingStatus = 'pending' | 'active' | 'completed' | 'failed'

export interface AtcHealingOperation {
  id: string
  healingId: string
  healingType: AtcHealingType
  status: AtcHealingStatus
  ownerServerId: string
  targetNode: string
  healingNonce: string
  healingData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateHealingOperationParams {
  healingType: AtcHealingType
  ownerServerId: string
  targetNode: string
  healingNonce: string
  healingData?: Record<string, unknown> | undefined
}

interface HealingOperationRow extends RowDataPacket {
  id: string
  healing_id: string
  healing_type: string
  status: string
  owner_server_id: string
  target_node: string
  healing_nonce: string
  healing_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: HealingOperationRow): AtcHealingOperation {
  let healingData: Record<string, unknown> = {}
  if (row.healing_data) {
    try { healingData = JSON.parse(row.healing_data) as Record<string, unknown> } catch { healingData = {} }
  }
  return {
    id: row.id,
    healingId: row.healing_id,
    healingType: row.healing_type as AtcHealingType,
    status: row.status as AtcHealingStatus,
    ownerServerId: row.owner_server_id,
    targetNode: row.target_node,
    healingNonce: row.healing_nonce,
    healingData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class HealingOperationRepository {
  constructor(private readonly pool: MetaRuntimePool) {}

  async create(params: CreateHealingOperationParams): Promise<AtcHealingOperation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const healingId = generateId()
      const healingDataJson = JSON.stringify(params.healingData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_healing
             (id, healing_id, healing_type, status, owner_server_id, target_node, healing_nonce,
              healing_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, healingId, params.healingType, params.ownerServerId,
           params.targetNode, params.healingNonce, healingDataJson] as string[],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateHealingError(params.healingNonce)
        throw err
      }

      const [rows] = await conn.execute<HealingOperationRow[]>(
        `SELECT id, healing_id, healing_type, status, owner_server_id, target_node, healing_nonce,
                healing_data, completed_at, created_at, updated_at
         FROM atc_runtime_healing WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new HealingNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcHealingOperation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<HealingOperationRow[]>(
        `SELECT id, healing_id, healing_type, status, owner_server_id, target_node, healing_nonce,
                healing_data, completed_at, created_at, updated_at
         FROM atc_runtime_healing WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcHealingStatus, completedAt?: Date | undefined): Promise<AtcHealingOperation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<HealingOperationRow[]>(
          `SELECT id FROM atc_runtime_healing WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new HealingNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_healing SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[],
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_healing SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id],
          )
        }

        const [rows] = await conn.execute<HealingOperationRow[]>(
          `SELECT id, healing_id, healing_type, status, owner_server_id, target_node, healing_nonce,
                  healing_data, completed_at, created_at, updated_at
           FROM atc_runtime_healing WHERE id = ? LIMIT 1`,
          [id],
        )
        const row = rows[0]
        if (!row) throw new HealingNotFoundError(id)
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
        `DELETE FROM atc_runtime_healing
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
