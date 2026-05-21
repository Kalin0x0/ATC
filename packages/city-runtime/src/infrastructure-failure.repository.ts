import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  InfrastructureFailureNotFoundError,
  InfrastructureAlreadyRecoveredError,
} from './errors.js'

export type AtcFailureType =
  | 'power_outage'
  | 'water_leak'
  | 'gas_leak'
  | 'road_damage'
  | 'bridge_failure'
  | 'telecom_outage'
  | 'other'

export type AtcFailureStatus = 'active' | 'recovering' | 'resolved'

export interface AtcInfrastructureFailure {
  id: string
  nodeId: string
  failureType: AtcFailureType
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: AtcFailureStatus
  failureNonce: string
  reportedByPrincipalId: string | null
  recoveredByPrincipalId: string | null
  failedAt: Date
  recoveredAt: Date | null
  description: string
  createdAt: Date
  updatedAt: Date
}

export interface ReportFailureParams {
  nodeId: string
  failureType: AtcFailureType
  severity: 'low' | 'medium' | 'high' | 'critical'
  failureNonce: string
  reportedByPrincipalId?: string | null | undefined
  description?: string | undefined
}

interface FailureRow extends RowDataPacket {
  id: string
  node_id: string
  failure_type: string
  severity: string
  status: string
  failure_nonce: string
  reported_by_principal_id: string | null
  recovered_by_principal_id: string | null
  failed_at: Date
  recovered_at: Date | null
  description: string
  created_at: Date
  updated_at: Date
}

function rowToFailure(row: FailureRow): AtcInfrastructureFailure {
  return {
    id: row.id,
    nodeId: row.node_id,
    failureType: row.failure_type as AtcFailureType,
    severity: row.severity as 'low' | 'medium' | 'high' | 'critical',
    status: row.status as AtcFailureStatus,
    failureNonce: row.failure_nonce,
    reportedByPrincipalId: row.reported_by_principal_id,
    recoveredByPrincipalId: row.recovered_by_principal_id,
    failedAt: row.failed_at,
    recoveredAt: row.recovered_at,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const TERMINAL_STATUSES: AtcFailureStatus[] = ['resolved']

export interface TransitionFailureOptions {
  recoveredByPrincipalId?: string | null | undefined
}

export class InfrastructureFailureRepository {
  constructor(private readonly pool: CityRuntimePool) {}

  async create(params: ReportFailureParams): Promise<AtcInfrastructureFailure> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_infrastructure_failures
             (id, node_id, failure_type, severity, status, failure_nonce,
              reported_by_principal_id, description, failed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3), NOW(3))`,
          [
            id,
            params.nodeId,
            params.failureType,
            params.severity,
            params.failureNonce,
            params.reportedByPrincipalId ?? null,
            params.description ?? '',
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          // Nonce already exists — return the existing record for idempotency
          const [rows] = await conn.execute<FailureRow[]>(
            `SELECT * FROM atc_infrastructure_failures WHERE failure_nonce = ? LIMIT 1`,
            [params.failureNonce],
          )
          if (!rows[0]) throw err
          return rowToFailure(rows[0])
        }
        throw err
      }
      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new InfrastructureFailureNotFoundError(id)
      return rowToFailure(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcInfrastructureFailure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToFailure(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByNonce(nonce: string): Promise<AtcInfrastructureFailure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures WHERE failure_nonce = ? LIMIT 1`,
        [nonce],
      )
      return rows[0] ? rowToFailure(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveByNode(nodeId: string): Promise<AtcInfrastructureFailure[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures
         WHERE node_id = ? AND status IN ('active', 'recovering')
         ORDER BY failed_at DESC`,
        [nodeId],
      )
      return rows.map(rowToFailure)
    } finally {
      conn.release()
    }
  }

  async transition(
    id: string,
    status: AtcFailureStatus,
    opts: TransitionFailureOptions = {},
  ): Promise<AtcInfrastructureFailure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<FailureRow[]>(
          `SELECT * FROM atc_infrastructure_failures WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!lockRows[0]) throw new InfrastructureFailureNotFoundError(id)

        const current = rowToFailure(lockRows[0])
        if (TERMINAL_STATUSES.includes(current.status)) {
          throw new InfrastructureAlreadyRecoveredError(id)
        }

        const isResolving = status === 'resolved'

        await conn.execute(
          `UPDATE atc_infrastructure_failures
           SET status                       = ?,
               recovered_by_principal_id    = ${isResolving ? 'COALESCE(?, recovered_by_principal_id)' : 'recovered_by_principal_id'},
               recovered_at                 = ${isResolving ? 'NOW(3)' : 'recovered_at'},
               updated_at                   = NOW(3)
           WHERE id = ?`,
          isResolving
            ? [status, opts.recoveredByPrincipalId ?? null, id]
            : [status, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new InfrastructureFailureNotFoundError(id)
      return rowToFailure(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcInfrastructureFailure[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures
         WHERE status IN ('active', 'recovering')
         ORDER BY failed_at DESC`,
      )
      return rows.map(rowToFailure)
    } finally {
      conn.release()
    }
  }

  async listByNode(nodeId: string, limit?: number | undefined): Promise<AtcInfrastructureFailure[]> {
    const conn = await this.pool.getConnection()
    try {
      const effectiveLimit = limit ?? 50
      const [rows] = await conn.execute<FailureRow[]>(
        `SELECT * FROM atc_infrastructure_failures
         WHERE node_id = ?
         ORDER BY failed_at DESC
         LIMIT ?`,
        [nodeId, effectiveLimit],
      )
      return rows.map(rowToFailure)
    } finally {
      conn.release()
    }
  }

  async deleteStale(olderThanHours: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_infrastructure_failures
         WHERE status = 'resolved'
           AND recovered_at < DATE_SUB(NOW(3), INTERVAL ? HOUR)`,
        [olderThanHours],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
