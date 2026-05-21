import type { RowDataPacket } from 'mysql2/promise'
import type { AtcCriminalOperation, AtcOperationStatus, AtcOperationType } from '@atc/shared-types'
import type { CriminalPool } from './pool.js'
import { generateId } from './id.js'
import { GangOperationNotFoundError, GangOperationImmutableError } from './errors.js'

interface OperationRow extends RowDataPacket {
  id: string
  label: string
  operation_type: string
  owner_principal_id: string
  gang_id: string | null
  status: string
  started_at: Date | null
  ended_at: Date | null
  outcome: string | null
  metadata: string | null
  created_at: Date
  updated_at: Date
}

function rowToOperation(row: OperationRow): AtcCriminalOperation {
  return {
    id: row.id,
    label: row.label,
    operationType: row.operation_type as AtcOperationType,
    ownerPrincipalId: row.owner_principal_id,
    gangId: row.gang_id,
    status: row.status as AtcOperationStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcome: row.outcome,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcOperationStatus, AtcOperationStatus[]> = {
  planning:  ['active', 'aborted'],
  active:    ['completed', 'failed', 'aborted'],
  completed: [],
  failed:    [],
  aborted:   [],
}

export interface CreateOperationParams {
  label: string
  operationType: AtcOperationType
  ownerPrincipalId: string
  gangId?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

export interface TransitionOperationOpts {
  outcome?: string | undefined
}

export class CriminalOperationRepository {
  constructor(private readonly pool: CriminalPool) {}

  async create(params: CreateOperationParams): Promise<AtcCriminalOperation> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_criminal_operations
           (id, label, operation_type, owner_principal_id, gang_id, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'planning', ?, NOW(3), NOW(3))`,
        [
          id,
          params.label,
          params.operationType,
          params.ownerPrincipalId,
          params.gangId ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      const op = await this._findById(conn, id)
      if (!op) throw new GangOperationNotFoundError(id)
      return op
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<AtcCriminalOperation | null> {
    if (conn) {
      return this._findById(conn, id)
    }
    const c = await this.pool.getConnection()
    try {
      return this._findById(c, id)
    } finally {
      c.release()
    }
  }

  async transition(
    id: string,
    toStatus: AtcOperationStatus,
    opts?: TransitionOperationOpts,
  ): Promise<AtcCriminalOperation> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<OperationRow[]>(
          `SELECT * FROM atc_criminal_operations WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new GangOperationNotFoundError(id)
        const current = rowToOperation(rows[0])

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(toStatus)) {
          throw new GangOperationImmutableError(id, current.status, toStatus)
        }

        const now = new Date()
        const startedAt = toStatus === 'active' ? now : current.startedAt
        const endedAt =
          toStatus === 'completed' || toStatus === 'failed' || toStatus === 'aborted'
            ? now
            : current.endedAt

        await conn.execute(
          `UPDATE atc_criminal_operations
           SET status = ?, started_at = ?, ended_at = ?, outcome = COALESCE(?, outcome), updated_at = NOW(3)
           WHERE id = ?`,
          [toStatus, startedAt ?? null, endedAt ?? null, opts?.outcome ?? null, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, id)
      if (!updated) throw new GangOperationNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async listByOwner(principalId: string): Promise<AtcCriminalOperation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OperationRow[]>(
        `SELECT * FROM atc_criminal_operations WHERE owner_principal_id = ? ORDER BY created_at DESC`,
        [principalId],
      )
      return rows.map(rowToOperation)
    } finally {
      conn.release()
    }
  }

  async listByGang(gangId: string): Promise<AtcCriminalOperation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OperationRow[]>(
        `SELECT * FROM atc_criminal_operations WHERE gang_id = ? ORDER BY created_at DESC`,
        [gangId],
      )
      return rows.map(rowToOperation)
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcOperationStatus): Promise<AtcCriminalOperation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OperationRow[]>(
        `SELECT * FROM atc_criminal_operations WHERE status = ? ORDER BY created_at DESC`,
        [status],
      )
      return rows.map(rowToOperation)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CriminalPool['getConnection']>>,
    id: string,
  ): Promise<AtcCriminalOperation | null> {
    const [rows] = await conn.execute<OperationRow[]>(
      `SELECT * FROM atc_criminal_operations WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToOperation(rows[0]) : null
  }
}
