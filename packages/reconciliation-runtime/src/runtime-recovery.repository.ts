import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReconciliationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { RuntimeRecoveryNotFoundError } from './errors.js'

export type AtcRecoveryType = 'snapshot' | 'migration' | 'ownership' | 'custom'
export type AtcRecoveryStatus = 'pending' | 'recovering' | 'completed' | 'failed'

export interface AtcRuntimeRecovery {
  id: string
  recoveryId: string
  entityId: string
  recoveryType: AtcRecoveryType
  targetServerId: string | null
  recoveryStatus: AtcRecoveryStatus
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateRecoveryParams {
  entityId: string
  recoveryType: AtcRecoveryType
  targetServerId?: string | undefined
}

interface RuntimeRecoveryRow extends RowDataPacket {
  id: string
  recovery_id: string
  entity_id: string
  recovery_type: string
  target_server_id: string | null
  recovery_status: string
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeRecoveryRow): AtcRuntimeRecovery {
  return {
    id: row.id,
    recoveryId: row.recovery_id,
    entityId: row.entity_id,
    recoveryType: row.recovery_type as AtcRecoveryType,
    targetServerId: row.target_server_id,
    recoveryStatus: row.recovery_status as AtcRecoveryStatus,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeRecoveryRepository {
  constructor(private readonly pool: ReconciliationRuntimePool) {}

  async findById(recoveryId: string): Promise<AtcRuntimeRecovery | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeRecoveryRow[]>(
        `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                recovery_status, completed_at, created_at, updated_at
         FROM atc_runtime_recovery
         WHERE recovery_id = ?
         LIMIT 1`,
        [recoveryId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async create(params: CreateRecoveryParams): Promise<AtcRuntimeRecovery> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const recoveryId = generateId()

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_recovery
           (id, recovery_id, entity_id, recovery_type, target_server_id,
            recovery_status, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, NOW(3), NOW(3))`,
        [
          id,
          recoveryId,
          params.entityId,
          params.recoveryType,
          params.targetServerId ?? null,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<RuntimeRecoveryRow[]>(
        `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                recovery_status, completed_at, created_at, updated_at
         FROM atc_runtime_recovery
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime recovery not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async complete(recoveryId: string): Promise<AtcRuntimeRecovery> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<RuntimeRecoveryRow[]>(
          `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                  recovery_status, completed_at, created_at, updated_at
           FROM atc_runtime_recovery
           WHERE recovery_id = ?
           LIMIT 1
           FOR UPDATE`,
          [recoveryId]
        )
        if (!rows[0]) throw new RuntimeRecoveryNotFoundError(recoveryId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_recovery
           SET recovery_status = 'completed', completed_at = NOW(3), updated_at = NOW(3)
           WHERE recovery_id = ?`,
          [recoveryId]
        )

        const [updated] = await conn.execute<RuntimeRecoveryRow[]>(
          `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                  recovery_status, completed_at, created_at, updated_at
           FROM atc_runtime_recovery
           WHERE recovery_id = ?
           LIMIT 1`,
          [recoveryId]
        )
        if (!updated[0]) throw new RuntimeRecoveryNotFoundError(recoveryId)

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

  async fail(recoveryId: string): Promise<AtcRuntimeRecovery> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<RuntimeRecoveryRow[]>(
          `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                  recovery_status, completed_at, created_at, updated_at
           FROM atc_runtime_recovery
           WHERE recovery_id = ?
           LIMIT 1
           FOR UPDATE`,
          [recoveryId]
        )
        if (!rows[0]) throw new RuntimeRecoveryNotFoundError(recoveryId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_recovery
           SET recovery_status = 'failed', updated_at = NOW(3)
           WHERE recovery_id = ?`,
          [recoveryId]
        )

        const [updated] = await conn.execute<RuntimeRecoveryRow[]>(
          `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                  recovery_status, completed_at, created_at, updated_at
           FROM atc_runtime_recovery
           WHERE recovery_id = ?
           LIMIT 1`,
          [recoveryId]
        )
        if (!updated[0]) throw new RuntimeRecoveryNotFoundError(recoveryId)

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

  async listActive(): Promise<AtcRuntimeRecovery[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeRecoveryRow[]>(
        `SELECT id, recovery_id, entity_id, recovery_type, target_server_id,
                recovery_status, completed_at, created_at, updated_at
         FROM atc_runtime_recovery
         WHERE recovery_status IN ('pending', 'recovering')
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
