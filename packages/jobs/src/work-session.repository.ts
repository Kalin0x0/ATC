import type { RowDataPacket } from 'mysql2/promise'
import type { AtcWorkSession, AtcWorkSessionPage, WorkSessionStatus } from '@atc/shared-types'
import type { JobsPool } from './pool.js'
import { generateId } from './id.js'
import {
  WorkSessionNotFoundError,
  AlreadyClockedInError,
  NotClockedInError,
  ContractNotActiveError,
  ContractNotFoundError,
} from './errors.js'

interface WorkSessionRow extends RowDataPacket {
  id: string
  contract_id: string
  character_id: string
  job_id: string
  clocked_in_at: Date
  clocked_out_at: Date | null
  duration_seconds: number | null
  location_json: string | null
  verified_by: string | null
  status: string
  created_at: Date
  updated_at: Date
}

function rowToSession(row: WorkSessionRow): AtcWorkSession {
  return {
    id: row.id,
    contractId: row.contract_id,
    characterId: row.character_id,
    jobId: row.job_id,
    clockedInAt: row.clocked_in_at,
    clockedOutAt: row.clocked_out_at,
    durationSeconds: row.duration_seconds,
    locationMetadata: row.location_json ? JSON.parse(row.location_json) as Record<string, unknown> : null,
    verifiedBy: row.verified_by,
    status: row.status as WorkSessionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface ClockInParams {
  contractId: string
  characterId: string
  jobId: string
  locationMetadata?: Record<string, unknown> | null | undefined
}

export interface ClockOutParams {
  characterId: string
  locationMetadata?: Record<string, unknown> | null | undefined
  verifiedBy?: string | null | undefined
}

export interface ListWorkSessionsParams {
  characterId?: string | undefined
  contractId?: string | undefined
  jobId?: string | undefined
  status?: WorkSessionStatus | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export class WorkSessionRepository {
  constructor(private readonly pool: JobsPool) {}

  async clockIn(params: ClockInParams): Promise<AtcWorkSession> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // FIX BUG-3: Verify contract exists, belongs to character, and is active — all inside the
      // transaction so status cannot change between check and insert (TOCTOU prevention).
      const [contractRows] = await conn.execute<(RowDataPacket & { id: string; status: string; character_id: string })[]>(
        `SELECT id, status, character_id FROM atc_employment_contracts
         WHERE id = ? LIMIT 1 FOR UPDATE`,
        [params.contractId],
      )
      const contract = contractRows[0]
      if (!contract) {
        await conn.rollback()
        throw new ContractNotFoundError(params.contractId)
      }
      if (contract.character_id !== params.characterId) {
        await conn.rollback()
        throw new ContractNotFoundError(params.contractId)
      }
      if (contract.status !== 'active') {
        await conn.rollback()
        throw new ContractNotActiveError(params.contractId, contract.status)
      }

      // Prevent duplicate active sessions — lock the existing row if any
      const [activeRows] = await conn.execute<WorkSessionRow[]>(
        `SELECT id FROM atc_work_sessions
         WHERE character_id = ? AND status = 'active'
         LIMIT 1 FOR UPDATE`,
        [params.characterId],
      )
      if (activeRows[0]) {
        await conn.rollback()
        throw new AlreadyClockedInError(params.characterId)
      }

      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_work_sessions
           (id, contract_id, character_id, job_id, clocked_in_at, location_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(3), ?, 'active', NOW(3), NOW(3))`,
        [
          id, params.contractId, params.characterId, params.jobId,
          params.locationMetadata ? JSON.stringify(params.locationMetadata) : null,
        ],
      )

      await conn.commit()

      const session = await this._findById(id)
      if (!session) throw new WorkSessionNotFoundError(id)
      return session
    } catch (err) {
      try { await conn.rollback() } catch { /* best-effort */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async clockOut(params: ClockOutParams): Promise<AtcWorkSession> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorkSessionRow[]>(
        `SELECT * FROM atc_work_sessions
         WHERE character_id = ? AND status = 'active'
         ORDER BY clocked_in_at DESC
         LIMIT 1`,
        [params.characterId],
      )
      const activeSession = rows[0]
      if (!activeSession) throw new NotClockedInError(params.characterId)

      const clockedOutAt = new Date()
      const durationSeconds = Math.floor((clockedOutAt.getTime() - activeSession.clocked_in_at.getTime()) / 1000)

      await conn.execute(
        `UPDATE atc_work_sessions
         SET status = 'completed', clocked_out_at = ?, duration_seconds = ?,
             location_json = ?, verified_by = ?, updated_at = NOW(3)
         WHERE id = ?`,
        [
          clockedOutAt, durationSeconds,
          params.locationMetadata ? JSON.stringify(params.locationMetadata) : activeSession.location_json,
          params.verifiedBy ?? null,
          activeSession.id,
        ],
      )

      const session = await this._findById(activeSession.id)
      if (!session) throw new WorkSessionNotFoundError(activeSession.id)
      return session
    } finally {
      conn.release()
    }
  }

  async findActiveSession(characterId: string): Promise<AtcWorkSession | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorkSessionRow[]>(
        `SELECT * FROM atc_work_sessions
         WHERE character_id = ? AND status = 'active'
         ORDER BY clocked_in_at DESC LIMIT 1`,
        [characterId],
      )
      return rows[0] ? rowToSession(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcWorkSession | null> {
    return this._findById(id)
  }

  async list(params: ListWorkSessionsParams = {}): Promise<AtcWorkSessionPage> {
    const limit = Math.min(params.limit ?? 20, 100)
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const args: (string | number | null)[] = []
    if (params.characterId) { conditions.push('character_id = ?'); args.push(params.characterId) }
    if (params.contractId)  { conditions.push('contract_id = ?');  args.push(params.contractId) }
    if (params.jobId)       { conditions.push('job_id = ?');       args.push(params.jobId) }
    if (params.status)      { conditions.push('status = ?');       args.push(params.status) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_work_sessions ${where}`, args,
      )
      const total = countRows[0]?.total ?? 0
      const [rows] = await conn.execute<WorkSessionRow[]>(
        `SELECT * FROM atc_work_sessions ${where} ORDER BY clocked_in_at DESC LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      )
      return { items: rows.map(rowToSession), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  private async _findById(id: string): Promise<AtcWorkSession | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WorkSessionRow[]>(
        'SELECT * FROM atc_work_sessions WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToSession(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
