import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeResiliencePool } from './pool.js'
import { generateId } from './id.js'
import { ChaosRuntimeNotFoundError, DuplicateChaosTestError } from './errors.js'

export type AtcChaosTestType =
  | 'network_partition'
  | 'server_crash'
  | 'latency_injection'
  | 'resource_exhaustion'
  | 'split_brain'
  | 'custom'

export type AtcChaosTestStatus = 'pending' | 'running' | 'completed' | 'aborted'

export interface AtcChaosRuntime {
  id: string
  testId: string
  testType: AtcChaosTestType
  status: AtcChaosTestStatus
  targetServerId: string | null
  chaosData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateChaosTestParams {
  testId: string
  testType: AtcChaosTestType
  targetServerId?: string | undefined
  chaosData?: Record<string, unknown> | undefined
}

interface ChaosRuntimeRow extends RowDataPacket {
  id: string
  test_id: string
  test_type: string
  status: string
  target_server_id: string | null
  chaos_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ChaosRuntimeRow): AtcChaosRuntime {
  let chaosData: Record<string, unknown> = {}
  if (row.chaos_data) {
    try {
      chaosData = JSON.parse(row.chaos_data) as Record<string, unknown>
    } catch {
      chaosData = {}
    }
  }
  return {
    id: row.id,
    testId: row.test_id,
    testType: row.test_type as AtcChaosTestType,
    status: row.status as AtcChaosTestStatus,
    targetServerId: row.target_server_id,
    chaosData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ChaosRuntimeRepository {
  constructor(private readonly pool: RuntimeResiliencePool) {}

  async create(params: CreateChaosTestParams): Promise<AtcChaosRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const chaosDataJson = JSON.stringify(params.chaosData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_chaos_runtime
             (id, test_id, test_type, status, target_server_id,
              chaos_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [
            id,
            params.testId,
            params.testType,
            params.targetServerId ?? null,
            chaosDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateChaosTestError(params.testId)
        }
        throw err
      }

      const [rows] = await conn.execute<ChaosRuntimeRow[]>(
        `SELECT id, test_id, test_type, status, target_server_id,
                chaos_data, started_at, completed_at, created_at, updated_at
         FROM atc_chaos_runtime
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Chaos runtime record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcChaosRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ChaosRuntimeRow[]>(
        `SELECT id, test_id, test_type, status, target_server_id,
                chaos_data, started_at, completed_at, created_at, updated_at
         FROM atc_chaos_runtime
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

  async findByTestId(testId: string): Promise<AtcChaosRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ChaosRuntimeRow[]>(
        `SELECT id, test_id, test_type, status, target_server_id,
                chaos_data, started_at, completed_at, created_at, updated_at
         FROM atc_chaos_runtime
         WHERE test_id = ?
         LIMIT 1`,
        [testId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcChaosTestStatus,
    completedAt?: Date | undefined
  ): Promise<AtcChaosRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ChaosRuntimeRow[]>(
          `SELECT id, test_id, test_type, status, target_server_id,
                  chaos_data, started_at, completed_at, created_at, updated_at
           FROM atc_chaos_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ChaosRuntimeNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_chaos_runtime
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_chaos_runtime
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<ChaosRuntimeRow[]>(
          `SELECT id, test_id, test_type, status, target_server_id,
                  chaos_data, started_at, completed_at, created_at, updated_at
           FROM atc_chaos_runtime
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ChaosRuntimeNotFoundError(id)

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

  async listActive(): Promise<AtcChaosRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ChaosRuntimeRow[]>(
        `SELECT id, test_id, test_type, status, target_server_id,
                chaos_data, started_at, completed_at, created_at, updated_at
         FROM atc_chaos_runtime
         WHERE status IN ('pending', 'running')
         ORDER BY created_at ASC`
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
