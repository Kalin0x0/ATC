import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReconciliationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  DuplicateMigrationNonceError,
  MigrationAlreadyCompletedError,
  RuntimeMigrationNotFoundError,
} from './errors.js'

export type AtcMigrationStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface AtcRuntimeMigration {
  id: string
  migrationId: string
  migrationNonce: string
  entityId: string
  fromServerId: string
  toServerId: string
  status: AtcMigrationStatus
  migrationData: Record<string, unknown>
  failureReason: string | null
  completedAt: Date | null
  failedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateMigrationParams {
  migrationNonce: string
  entityId: string
  fromServerId: string
  toServerId: string
  migrationData?: Record<string, unknown> | undefined
}

interface RuntimeMigrationRow extends RowDataPacket {
  id: string
  migration_id: string
  migration_nonce: string
  entity_id: string
  from_server_id: string
  to_server_id: string
  status: string
  migration_data: string | null
  failure_reason: string | null
  completed_at: Date | null
  failed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeMigrationRow): AtcRuntimeMigration {
  let migrationData: Record<string, unknown> = {}
  if (row.migration_data) {
    try {
      migrationData = JSON.parse(row.migration_data) as Record<string, unknown>
    } catch {
      migrationData = {}
    }
  }
  return {
    id: row.id,
    migrationId: row.migration_id,
    migrationNonce: row.migration_nonce,
    entityId: row.entity_id,
    fromServerId: row.from_server_id,
    toServerId: row.to_server_id,
    status: row.status as AtcMigrationStatus,
    migrationData,
    failureReason: row.failure_reason,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeMigrationRepository {
  constructor(private readonly pool: ReconciliationRuntimePool) {}

  async findById(migrationId: string): Promise<AtcRuntimeMigration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeMigrationRow[]>(
        `SELECT id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
                status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at
         FROM atc_runtime_migrations
         WHERE migration_id = ?
         LIMIT 1`,
        [migrationId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async create(params: CreateMigrationParams): Promise<AtcRuntimeMigration> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const migrationId = generateId()
      const migrationDataJson = params.migrationData
        ? JSON.stringify(params.migrationData)
        : null

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_migrations
             (id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
              status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL, NOW(3), NOW(3))`,
          [
            id,
            migrationId,
            params.migrationNonce,
            params.entityId,
            params.fromServerId,
            params.toServerId,
            migrationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateMigrationNonceError(params.migrationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeMigrationRow[]>(
        `SELECT id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
                status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at
         FROM atc_runtime_migrations
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime migration not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async transition(
    migrationId: string,
    status: AtcMigrationStatus,
    failureReason?: string | undefined
  ): Promise<AtcRuntimeMigration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<RuntimeMigrationRow[]>(
          `SELECT id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
                  status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at
           FROM atc_runtime_migrations
           WHERE migration_id = ?
           LIMIT 1
           FOR UPDATE`,
          [migrationId]
        )
        if (!rows[0]) throw new RuntimeMigrationNotFoundError(migrationId)
        const current = mapRow(rows[0])
        if (current.status === 'completed') {
          throw new MigrationAlreadyCompletedError(migrationId)
        }

        const binds: (string | number | boolean | null)[] = [status]

        let sql: string
        if (status === 'completed') {
          sql = `UPDATE atc_runtime_migrations
                 SET status = ?, completed_at = NOW(3), updated_at = NOW(3)
                 WHERE migration_id = ?`
        } else if (status === 'failed') {
          sql = `UPDATE atc_runtime_migrations
                 SET status = ?, failed_at = NOW(3), failure_reason = ?, updated_at = NOW(3)
                 WHERE migration_id = ?`
          binds.push(failureReason ?? null)
        } else {
          sql = `UPDATE atc_runtime_migrations
                 SET status = ?, updated_at = NOW(3)
                 WHERE migration_id = ?`
        }
        binds.push(migrationId)

        await conn.execute<ResultSetHeader>(sql, binds)

        const [updated] = await conn.execute<RuntimeMigrationRow[]>(
          `SELECT id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
                  status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at
           FROM atc_runtime_migrations
           WHERE migration_id = ?
           LIMIT 1`,
          [migrationId]
        )
        if (!updated[0]) throw new RuntimeMigrationNotFoundError(migrationId)

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

  async listActive(): Promise<AtcRuntimeMigration[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeMigrationRow[]>(
        `SELECT id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
                status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at
         FROM atc_runtime_migrations
         WHERE status IN ('pending', 'in_progress')
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listStale(thresholdMs: number): Promise<AtcRuntimeMigration[]> {
    const conn = await this.pool.getConnection()
    try {
      const cutoff = new Date(Date.now() - thresholdMs)
      const [rows] = await conn.execute<RuntimeMigrationRow[]>(
        `SELECT id, migration_id, migration_nonce, entity_id, from_server_id, to_server_id,
                status, migration_data, failure_reason, completed_at, failed_at, created_at, updated_at
         FROM atc_runtime_migrations
         WHERE status IN ('pending', 'in_progress')
           AND created_at < ?
         ORDER BY created_at ASC`,
        [cutoff.toISOString()]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
