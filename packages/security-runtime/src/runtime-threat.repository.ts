import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { SecurityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateThreatError, ThreatNotFoundError } from './errors.js'

export type AtcThreatType =
  | 'botnet'
  | 'exploit'
  | 'dos'
  | 'data_leak'
  | 'privilege_escalation'
  | 'custom'

export type AtcThreatSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AtcThreatStatus = 'active' | 'mitigated' | 'resolved' | 'escalated'

export interface AtcRuntimeThreat {
  id: string
  threatId: string
  threatType: AtcThreatType
  severity: AtcThreatSeverity
  status: AtcThreatStatus
  ownerServerId: string
  entityId: string | null
  threatNonce: string
  resolvedAt: Date | null
  threatData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateThreatParams {
  threatType: AtcThreatType
  severity: AtcThreatSeverity
  ownerServerId: string
  threatNonce: string
  entityId?: string | undefined
  threatData?: Record<string, unknown> | undefined
}

interface ThreatRow extends RowDataPacket {
  id: string
  threat_id: string
  threat_type: AtcThreatType
  severity: AtcThreatSeverity
  status: AtcThreatStatus
  owner_server_id: string
  entity_id: string | null
  threat_nonce: string
  resolved_at: Date | null
  threat_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: ThreatRow): AtcRuntimeThreat {
  return {
    id: row.id,
    threatId: row.threat_id,
    threatType: row.threat_type,
    severity: row.severity,
    status: row.status,
    ownerServerId: row.owner_server_id,
    entityId: row.entity_id,
    threatNonce: row.threat_nonce,
    resolvedAt: row.resolved_at,
    threatData: typeof row.threat_data === 'string' ? JSON.parse(row.threat_data) : row.threat_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeThreatRepository {
  constructor(private pool: SecurityRuntimePool) {}

  async create(params: CreateThreatParams): Promise<AtcRuntimeThreat> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const threatId = generateId()
      const threatData = JSON.stringify(params.threatData ?? {})
      try {
        await conn.execute(
          `INSERT INTO atc_runtime_threats
            (id, threat_id, threat_type, severity, status, owner_server_id, entity_id, threat_nonce, resolved_at, threat_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, NULL, ?, NOW(3), NOW(3))`,
          [id, threatId, params.threatType, params.severity, params.ownerServerId, params.entityId ?? null, params.threatNonce, threatData],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateThreatError(params.threatNonce)
        }
        throw err
      }
      const [rows] = await conn.execute<ThreatRow[]>(
        `SELECT * FROM atc_runtime_threats WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new ThreatNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeThreat | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ThreatRow[]>(
        `SELECT * FROM atc_runtime_threats WHERE id = ?`,
        [id],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcThreatStatus, resolvedAt?: Date): Promise<AtcRuntimeThreat> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [locked] = await conn.execute<ThreatRow[]>(
          `SELECT * FROM atc_runtime_threats WHERE id = ? FOR UPDATE`,
          [id],
        )
        if (!locked[0]) {
          throw new ThreatNotFoundError(id)
        }
        await conn.execute(
          `UPDATE atc_runtime_threats SET status = ?, resolved_at = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, resolvedAt ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const [rows] = await conn.execute<ThreatRow[]>(
        `SELECT * FROM atc_runtime_threats WHERE id = ?`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new ThreatNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async listActive(ownerServerId?: string): Promise<AtcRuntimeThreat[]> {
    const conn = await this.pool.getConnection()
    try {
      let rows: ThreatRow[]
      if (ownerServerId !== undefined) {
        const [result] = await conn.execute<ThreatRow[]>(
          `SELECT * FROM atc_runtime_threats WHERE status = 'active' AND owner_server_id = ? ORDER BY created_at DESC`,
          [ownerServerId],
        )
        rows = result
      } else {
        const [result] = await conn.execute<ThreatRow[]>(
          `SELECT * FROM atc_runtime_threats WHERE status = 'active' ORDER BY created_at DESC`,
        )
        rows = result
      }
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const threshold = new Date(Date.now() - thresholdMs)
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_threats WHERE status IN ('resolved', 'mitigated') AND updated_at < ?`,
        [threshold],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
