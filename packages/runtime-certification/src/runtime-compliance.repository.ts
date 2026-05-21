import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeCertificationPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateComplianceError, ComplianceNotFoundError } from './errors.js'

export type AtcComplianceType = 'policy' | 'regulatory' | 'security' | 'performance' | 'behavioral' | 'custom'
export type AtcComplianceStatus = 'active' | 'enforced' | 'violated' | 'expired' | 'bypassed'

export interface AtcRuntimeCompliance {
  id: string
  complianceId: string
  complianceType: AtcComplianceType
  status: AtcComplianceStatus
  ownerServerId: string
  complianceNonce: string
  complianceData: Record<string, unknown>
  enforcedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateComplianceParams {
  complianceType: AtcComplianceType
  ownerServerId: string
  complianceNonce: string
  complianceData?: Record<string, unknown> | undefined
}

interface RuntimeComplianceRow extends RowDataPacket {
  id: string
  compliance_id: string
  compliance_type: string
  status: string
  owner_server_id: string
  compliance_nonce: string
  compliance_data: string | null
  enforced_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeComplianceRow): AtcRuntimeCompliance {
  let complianceData: Record<string, unknown> = {}
  if (row.compliance_data) {
    try {
      complianceData = JSON.parse(row.compliance_data) as Record<string, unknown>
    } catch {
      complianceData = {}
    }
  }
  return {
    id: row.id,
    complianceId: row.compliance_id,
    complianceType: row.compliance_type as AtcComplianceType,
    status: row.status as AtcComplianceStatus,
    ownerServerId: row.owner_server_id,
    complianceNonce: row.compliance_nonce,
    complianceData,
    enforcedAt: row.enforced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeComplianceRepository {
  constructor(private readonly pool: RuntimeCertificationPool) {}

  async create(params: CreateComplianceParams): Promise<AtcRuntimeCompliance> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const complianceId = generateId()
      const complianceDataJson = JSON.stringify(params.complianceData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_compliance
             (id, compliance_id, compliance_type, status, owner_server_id, compliance_nonce,
              compliance_data, enforced_at, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [
            id,
            complianceId,
            params.complianceType,
            params.ownerServerId,
            params.complianceNonce,
            complianceDataJson,
          ] as (string | number | boolean | null)[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateComplianceError(params.complianceNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<RuntimeComplianceRow[]>(
        `SELECT id, compliance_id, compliance_type, status, owner_server_id, compliance_nonce,
                compliance_data, enforced_at, created_at, updated_at
         FROM atc_runtime_compliance
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime compliance record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeCompliance | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeComplianceRow[]>(
        `SELECT id, compliance_id, compliance_type, status, owner_server_id, compliance_nonce,
                compliance_data, enforced_at, created_at, updated_at
         FROM atc_runtime_compliance
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

  async updateStatus(
    id: string,
    status: AtcComplianceStatus,
    enforcedAt?: Date | undefined
  ): Promise<AtcRuntimeCompliance> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeComplianceRow[]>(
          `SELECT id, compliance_id, compliance_type, status, owner_server_id, compliance_nonce,
                  compliance_data, enforced_at, created_at, updated_at
           FROM atc_runtime_compliance
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ComplianceNotFoundError(id)

        if (enforcedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_compliance
             SET status = ?, enforced_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              enforcedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_compliance
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeComplianceRow[]>(
          `SELECT id, compliance_id, compliance_type, status, owner_server_id, compliance_nonce,
                  compliance_data, enforced_at, created_at, updated_at
           FROM atc_runtime_compliance
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ComplianceNotFoundError(id)

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
        `DELETE FROM atc_runtime_compliance
         WHERE status IN ('violated', 'expired', 'bypassed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
