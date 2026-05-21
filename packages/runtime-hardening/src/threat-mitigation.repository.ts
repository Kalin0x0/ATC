import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeHardeningPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateThreatMitigationError, ThreatMitigationNotFoundError } from './errors.js'

export type AtcMitigationType = 'block' | 'throttle' | 'quarantine' | 'alert' | 'custom'
export type AtcMitigationStatus = 'pending' | 'mitigating' | 'mitigated' | 'failed' | 'expired'

export interface AtcThreatMitigation {
  id: string
  mitigationId: string
  mitigationType: AtcMitigationType
  status: AtcMitigationStatus
  ownerServerId: string
  mitigationNonce: string
  mitigationData: Record<string, unknown>
  mitigatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateThreatMitigationParams {
  mitigationType: AtcMitigationType
  ownerServerId: string
  mitigationNonce: string
  mitigationData?: Record<string, unknown> | undefined
}

interface ThreatMitigationRow extends RowDataPacket {
  id: string
  mitigation_id: string
  mitigation_type: string
  status: string
  owner_server_id: string
  mitigation_nonce: string
  mitigation_data: string | null
  mitigated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ThreatMitigationRow): AtcThreatMitigation {
  let mitigationData: Record<string, unknown> = {}
  if (row.mitigation_data) {
    try {
      mitigationData = JSON.parse(row.mitigation_data) as Record<string, unknown>
    } catch {
      mitigationData = {}
    }
  }
  return {
    id: row.id,
    mitigationId: row.mitigation_id,
    mitigationType: row.mitigation_type as AtcMitigationType,
    status: row.status as AtcMitigationStatus,
    ownerServerId: row.owner_server_id,
    mitigationNonce: row.mitigation_nonce,
    mitigationData,
    mitigatedAt: row.mitigated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ThreatMitigationRepository {
  constructor(private readonly pool: RuntimeHardeningPool) {}

  async create(params: CreateThreatMitigationParams): Promise<AtcThreatMitigation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const mitigationId = generateId()
      const mitigationDataJson = JSON.stringify(params.mitigationData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_threat_mitigation
             (id, mitigation_id, mitigation_type, status, owner_server_id, mitigation_nonce,
              mitigation_data, mitigated_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            mitigationId,
            params.mitigationType,
            params.ownerServerId,
            params.mitigationNonce,
            mitigationDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateThreatMitigationError(params.mitigationNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<ThreatMitigationRow[]>(
        `SELECT id, mitigation_id, mitigation_type, status, owner_server_id, mitigation_nonce,
                mitigation_data, mitigated_at, created_at, updated_at
         FROM atc_threat_mitigation
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) throw new Error(`Threat mitigation record not found after insert: ${id}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcThreatMitigation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ThreatMitigationRow[]>(
        `SELECT id, mitigation_id, mitigation_type, status, owner_server_id, mitigation_nonce,
                mitigation_data, mitigated_at, created_at, updated_at
         FROM atc_threat_mitigation
         WHERE id = ?
         LIMIT 1`,
        [id] as (string | number | boolean | null)[]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcMitigationStatus,
    mitigatedAt?: Date | undefined
  ): Promise<AtcThreatMitigation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ThreatMitigationRow[]>(
          `SELECT id, mitigation_id, mitigation_type, status, owner_server_id, mitigation_nonce,
                  mitigation_data, mitigated_at, created_at, updated_at
           FROM atc_threat_mitigation
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id] as (string | number | boolean | null)[]
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new ThreatMitigationNotFoundError(id)

        if (mitigatedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_threat_mitigation
             SET status = ?, mitigated_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              mitigatedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_threat_mitigation
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<ThreatMitigationRow[]>(
          `SELECT id, mitigation_id, mitigation_type, status, owner_server_id, mitigation_nonce,
                  mitigation_data, mitigated_at, created_at, updated_at
           FROM atc_threat_mitigation
           WHERE id = ?
           LIMIT 1`,
          [id] as (string | number | boolean | null)[]
        )
        const row = rows[0]
        if (!row) throw new ThreatMitigationNotFoundError(id)

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
        `DELETE FROM atc_threat_mitigation
         WHERE status IN ('mitigated', 'failed', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as (string | number | boolean | null)[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
