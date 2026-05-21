import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeGatewayPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateExposureError, ExposureNotFoundError } from './errors.js'

export type AtcExposureType = 'public' | 'internal' | 'restricted' | 'federated' | 'custom'
export type AtcExposureStatus = 'pending' | 'exposing' | 'exposed' | 'retracted' | 'failed'

export interface AtcRuntimeExposure {
  id: string; exposureId: string; exposureType: AtcExposureType; status: AtcExposureStatus
  ownerServerId: string; exposureNonce: string; exposureData: Record<string, unknown>
  exposedAt: Date | null; createdAt: Date; updatedAt: Date
}

export interface CreateExposureParams {
  exposureType: AtcExposureType; ownerServerId: string; exposureNonce: string
  exposureData?: Record<string, unknown> | undefined
}

interface ExposureRow extends RowDataPacket {
  id: string; exposure_id: string; exposure_type: string; status: string
  owner_server_id: string; exposure_nonce: string; exposure_data: string | null
  exposed_at: Date | null; created_at: Date; updated_at: Date
}

function mapRow(row: ExposureRow): AtcRuntimeExposure {
  return {
    id: row.id, exposureId: row.exposure_id,
    exposureType: row.exposure_type as AtcExposureType, status: row.status as AtcExposureStatus,
    ownerServerId: row.owner_server_id, exposureNonce: row.exposure_nonce,
    exposureData: row.exposure_data ? (JSON.parse(row.exposure_data) as Record<string, unknown>) : {},
    exposedAt: row.exposed_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export class RuntimeExposureRepository {
  constructor(private readonly pool: RuntimeGatewayPool) {}

  async create(params: CreateExposureParams): Promise<AtcRuntimeExposure> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId(); const exposureId = generateId()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_exposure (id, exposure_id, exposure_type, status, owner_server_id, exposure_nonce, exposure_data, exposed_at, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, exposureId, params.exposureType, params.ownerServerId, params.exposureNonce, JSON.stringify(params.exposureData ?? {})] as unknown[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateExposureError(params.exposureNonce)
        throw err
      }
      const [rows] = await conn.execute<ExposureRow[]>(
        `SELECT id, exposure_id, exposure_type, status, owner_server_id, exposure_nonce, exposure_data, exposed_at, created_at, updated_at FROM atc_runtime_exposure WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Exposure not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async findById(id: string): Promise<AtcRuntimeExposure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ExposureRow[]>(
        `SELECT id, exposure_id, exposure_type, status, owner_server_id, exposure_nonce, exposure_data, exposed_at, created_at, updated_at FROM atc_runtime_exposure WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async updateStatus(id: string, status: AtcExposureStatus, exposedAt?: Date | undefined): Promise<AtcRuntimeExposure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ExposureRow[]>(
          `SELECT id, exposure_id, exposure_type, status, owner_server_id, exposure_nonce, exposure_data, exposed_at, created_at, updated_at FROM atc_runtime_exposure WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ExposureNotFoundError(id)
        if (exposedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_exposure SET status = ?, exposed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, exposedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_exposure SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id] as unknown[]
          )
        }
        const [rows] = await conn.execute<ExposureRow[]>(
          `SELECT id, exposure_id, exposure_type, status, owner_server_id, exposure_nonce, exposure_data, exposed_at, created_at, updated_at FROM atc_runtime_exposure WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ExposureNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_exposure WHERE status IN ('retracted', 'failed') AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally { conn.release() }
  }
}
