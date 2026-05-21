import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeSustainmentPool } from './pool.js'
import { generateId } from './id.js'
import { SustainmentNotFoundError, DuplicateSustainmentError } from './errors.js'

export type AtcSustainmentType = 'continuous' | 'periodic' | 'on_demand' | 'emergency' | 'custom'
export type AtcSustainmentStatus = 'pending' | 'active' | 'maintaining' | 'completed' | 'failed'

export interface AtcRuntimeSustainment {
  id: string
  sustainmentId: string
  sustainmentType: AtcSustainmentType
  status: AtcSustainmentStatus
  ownerServerId: string
  sustainmentNonce: string
  sustainmentData: Record<string, unknown>
  startedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateSustainmentParams {
  sustainmentType: AtcSustainmentType
  ownerServerId: string
  sustainmentNonce: string
  sustainmentData?: Record<string, unknown> | undefined
}

interface RuntimeSustainmentRow extends RowDataPacket {
  id: string
  sustainment_id: string
  sustainment_type: string
  status: string
  owner_server_id: string
  sustainment_nonce: string
  sustainment_data: string | null
  started_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeSustainmentRow): AtcRuntimeSustainment {
  let sustainmentData: Record<string, unknown> = {}
  if (row.sustainment_data) {
    try {
      sustainmentData = JSON.parse(row.sustainment_data) as Record<string, unknown>
    } catch {
      sustainmentData = {}
    }
  }
  return {
    id: row.id,
    sustainmentId: row.sustainment_id,
    sustainmentType: row.sustainment_type as AtcSustainmentType,
    status: row.status as AtcSustainmentStatus,
    ownerServerId: row.owner_server_id,
    sustainmentNonce: row.sustainment_nonce,
    sustainmentData,
    startedAt: row.started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeSustainmentRepository {
  constructor(private readonly pool: RuntimeSustainmentPool) {}

  async create(params: CreateSustainmentParams): Promise<AtcRuntimeSustainment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const sustainmentId = generateId()
      const sustainmentDataJson = JSON.stringify(params.sustainmentData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_sustainment
             (id, sustainment_id, sustainment_type, status, owner_server_id,
              sustainment_nonce, sustainment_data, started_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            sustainmentId,
            params.sustainmentType,
            params.ownerServerId,
            params.sustainmentNonce,
            sustainmentDataJson,
          ] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateSustainmentError(params.sustainmentNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeSustainmentRow[]>(
        `SELECT id, sustainment_id, sustainment_type, status, owner_server_id,
                sustainment_nonce, sustainment_data, started_at, created_at, updated_at
         FROM atc_runtime_sustainment
         WHERE id = ?
         LIMIT 1`,
        [id] as unknown[]
      )
      if (!rows[0]) throw new Error(`Runtime sustainment not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeSustainment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeSustainmentRow[]>(
        `SELECT id, sustainment_id, sustainment_type, status, owner_server_id,
                sustainment_nonce, sustainment_data, started_at, created_at, updated_at
         FROM atc_runtime_sustainment
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
    status: AtcSustainmentStatus,
    startedAt?: Date | undefined
  ): Promise<AtcRuntimeSustainment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeSustainmentRow[]>(
          `SELECT id, sustainment_id, sustainment_type, status, owner_server_id,
                  sustainment_nonce, sustainment_data, started_at, created_at, updated_at
           FROM atc_runtime_sustainment
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as unknown[]
        )
        if (!lockRows[0]) throw new SustainmentNotFoundError(id)

        if (startedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_sustainment
             SET status = ?, started_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, startedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_sustainment
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as unknown[]
          )
        }

        const [rows] = await conn.execute<RuntimeSustainmentRow[]>(
          `SELECT id, sustainment_id, sustainment_type, status, owner_server_id,
                  sustainment_nonce, sustainment_data, started_at, created_at, updated_at
           FROM atc_runtime_sustainment
           WHERE id = ?
           LIMIT 1`,
          [id] as unknown[]
        )
        if (!rows[0]) throw new SustainmentNotFoundError(id)

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
        `DELETE FROM atc_runtime_sustainment
         WHERE status IN ('completed', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
