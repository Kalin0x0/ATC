import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeResiliencePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateRecoveryOperationError, RecoveryOperationNotFoundError } from './errors.js'

export type AtcRecoveryOperationType =
  | 'snapshot_restore'
  | 'state_repair'
  | 'ownership_reclaim'
  | 'replication_sync'
  | 'full_recovery'
  | 'custom'

export type AtcRecoveryOperationStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface AtcRecoveryOperation {
  id: string
  operationId: string
  operationType: AtcRecoveryOperationType
  status: AtcRecoveryOperationStatus
  entityId: string | null
  ownerServerId: string
  recoveryData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateRecoveryOperationParams {
  operationId: string
  operationType: AtcRecoveryOperationType
  ownerServerId: string
  entityId?: string | undefined
  recoveryData?: Record<string, unknown> | undefined
}

interface RecoveryOperationRow extends RowDataPacket {
  id: string
  operation_id: string
  operation_type: string
  status: string
  entity_id: string | null
  owner_server_id: string
  recovery_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RecoveryOperationRow): AtcRecoveryOperation {
  let recoveryData: Record<string, unknown> = {}
  if (row.recovery_data) {
    try {
      recoveryData = JSON.parse(row.recovery_data) as Record<string, unknown>
    } catch {
      recoveryData = {}
    }
  }
  return {
    id: row.id,
    operationId: row.operation_id,
    operationType: row.operation_type as AtcRecoveryOperationType,
    status: row.status as AtcRecoveryOperationStatus,
    entityId: row.entity_id,
    ownerServerId: row.owner_server_id,
    recoveryData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RecoveryOperationRepository {
  constructor(private readonly pool: RuntimeResiliencePool) {}

  async create(params: CreateRecoveryOperationParams): Promise<AtcRecoveryOperation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const recoveryDataJson = JSON.stringify(params.recoveryData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_recovery_operations
             (id, operation_id, operation_type, status, entity_id, owner_server_id,
              recovery_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [
            id,
            params.operationId,
            params.operationType,
            params.entityId ?? null,
            params.ownerServerId,
            recoveryDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateRecoveryOperationError(params.operationId)
        }
        throw err
      }

      const [rows] = await conn.execute<RecoveryOperationRow[]>(
        `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                recovery_data, started_at, completed_at, created_at, updated_at
         FROM atc_recovery_operations
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Recovery operation not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRecoveryOperation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecoveryOperationRow[]>(
        `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                recovery_data, started_at, completed_at, created_at, updated_at
         FROM atc_recovery_operations
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByOperationId(operationId: string): Promise<AtcRecoveryOperation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RecoveryOperationRow[]>(
        `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                recovery_data, started_at, completed_at, created_at, updated_at
         FROM atc_recovery_operations
         WHERE operation_id = ?
         LIMIT 1`,
        [operationId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcRecoveryOperationStatus,
    completedAt?: Date | undefined
  ): Promise<AtcRecoveryOperation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RecoveryOperationRow[]>(
          `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                  recovery_data, started_at, completed_at, created_at, updated_at
           FROM atc_recovery_operations
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new RecoveryOperationNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_recovery_operations
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_recovery_operations
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RecoveryOperationRow[]>(
          `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                  recovery_data, started_at, completed_at, created_at, updated_at
           FROM atc_recovery_operations
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new RecoveryOperationNotFoundError(id)

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

  async listActive(ownerServerId?: string | undefined): Promise<AtcRecoveryOperation[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<RecoveryOperationRow[]>(
          `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                  recovery_data, started_at, completed_at, created_at, updated_at
           FROM atc_recovery_operations
           WHERE status IN ('pending', 'in_progress')
             AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId]
        )
        return rows.map(mapRow)
      }
      const [rows] = await conn.execute<RecoveryOperationRow[]>(
        `SELECT id, operation_id, operation_type, status, entity_id, owner_server_id,
                recovery_data, started_at, completed_at, created_at, updated_at
         FROM atc_recovery_operations
         WHERE status IN ('pending', 'in_progress')
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
