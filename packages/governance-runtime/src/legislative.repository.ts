import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GovernanceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateLegislationError, LegislationNotFoundError } from './errors.js'

export type AtcLegislationType = 'law' | 'regulation' | 'ordinance' | 'decree' | 'custom'
export type AtcLegislationStatus = 'active' | 'repealed' | 'expired' | 'draft'

export interface AtcLegislativeRuntime {
  id: string
  legislationId: string
  legislationType: AtcLegislationType
  status: AtcLegislationStatus
  ownerServerId: string
  regionId: string | null
  legislationNonce: string
  legislationData: Record<string, unknown>
  enactedAt: Date
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface LegislativeRow extends RowDataPacket {
  id: string
  legislation_id: string
  legislation_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  legislation_nonce: string
  legislation_data: string
  enacted_at: Date
  expires_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: LegislativeRow): AtcLegislativeRuntime {
  let legislationData: Record<string, unknown> = {}
  try {
    legislationData = JSON.parse(row.legislation_data) as Record<string, unknown>
  } catch {
    legislationData = {}
  }
  return {
    id: row.id,
    legislationId: row.legislation_id,
    legislationType: row.legislation_type as AtcLegislationType,
    status: row.status as AtcLegislationStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    legislationNonce: row.legislation_nonce,
    legislationData,
    enactedAt: row.enacted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateLegislationParams {
  legislationId: string
  legislationType: AtcLegislationType
  ownerServerId: string
  regionId?: string | null | undefined
  legislationNonce: string
  legislationData?: Record<string, unknown> | undefined
  enactedAt?: Date | undefined
  expiresAt?: Date | null | undefined
}

export class LegislativeRepository {
  constructor(private readonly pool: GovernanceRuntimePool) {}

  async create(params: CreateLegislationParams): Promise<AtcLegislativeRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const legislationDataJson = JSON.stringify(params.legislationData ?? {})
      const enactedAt = params.enactedAt ?? new Date()
      const expiresAt = params.expiresAt ?? null
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_legislative_runtime
             (id, legislation_id, legislation_type, status, owner_server_id, region_id,
              legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.legislationId,
            params.legislationType,
            params.ownerServerId,
            params.regionId ?? null,
            params.legislationNonce,
            legislationDataJson,
            enactedAt,
            expiresAt,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateLegislationError(params.legislationId)
        }
        throw err
      }
      const [rows] = await conn.execute<LegislativeRow[]>(
        `SELECT id, legislation_id, legislation_type, status, owner_server_id, region_id,
                legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at
         FROM atc_legislative_runtime
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Legislation not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcLegislativeRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<LegislativeRow[]>(
        `SELECT id, legislation_id, legislation_type, status, owner_server_id, region_id,
                legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at
         FROM atc_legislative_runtime
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcLegislationStatus): Promise<AtcLegislativeRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<LegislativeRow[]>(
          `SELECT id, legislation_id, legislation_type, status, owner_server_id, region_id,
                  legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at
           FROM atc_legislative_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new LegislationNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_legislative_runtime
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id],
        )

        const [updated] = await conn.execute<LegislativeRow[]>(
          `SELECT id, legislation_id, legislation_type, status, owner_server_id, region_id,
                  legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at
           FROM atc_legislative_runtime
           WHERE id = ?
           LIMIT 1`,
          [id],
        )
        if (!updated[0]) throw new LegislationNotFoundError(id)

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

  async listActive(regionId?: string): Promise<AtcLegislativeRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      if (regionId !== undefined) {
        const [rows] = await conn.execute<LegislativeRow[]>(
          `SELECT id, legislation_id, legislation_type, status, owner_server_id, region_id,
                  legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at
           FROM atc_legislative_runtime
           WHERE status = 'active' AND region_id = ?
           ORDER BY created_at ASC`,
          [regionId],
        )
        return rows.map(mapRow)
      } else {
        const [rows] = await conn.execute<LegislativeRow[]>(
          `SELECT id, legislation_id, legislation_type, status, owner_server_id, region_id,
                  legislation_nonce, legislation_data, enacted_at, expires_at, created_at, updated_at
           FROM atc_legislative_runtime
           WHERE status = 'active'
           ORDER BY created_at ASC`,
        )
        return rows.map(mapRow)
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const thresholdDate = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_legislative_runtime
         WHERE status IN ('repealed', 'expired')
           AND updated_at < ?`,
        [thresholdDate],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
