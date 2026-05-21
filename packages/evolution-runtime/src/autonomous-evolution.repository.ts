import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EvolutionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { AutonomousEvolutionNotFoundError, DuplicateAutonomousEvolutionError } from './errors.js'

export type AtcAutonomousEvolutionType = 'self_heal' | 'self_tune' | 'self_scale' | 'self_optimize' | 'custom'
export type AtcAutonomousEvolutionStatus = 'triggered' | 'applying' | 'applied' | 'failed' | 'reverted'

export interface AtcAutonomousEvolution {
  id: string
  autonomousId: string
  autonomousType: AtcAutonomousEvolutionType
  status: AtcAutonomousEvolutionStatus
  ownerServerId: string
  autonomousNonce: string
  triggerData: Record<string, unknown>
  outcomeData: Record<string, unknown> | null
  appliedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAutonomousEvolutionParams {
  autonomousType: AtcAutonomousEvolutionType
  ownerServerId: string
  autonomousNonce: string
  triggerData?: Record<string, unknown> | undefined
}

interface AutonomousEvolutionRow extends RowDataPacket {
  id: string
  autonomous_id: string
  autonomous_type: string
  status: string
  owner_server_id: string
  autonomous_nonce: string
  trigger_data: string | null
  outcome_data: string | null
  applied_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AutonomousEvolutionRow): AtcAutonomousEvolution {
  let triggerData: Record<string, unknown> = {}
  if (row.trigger_data) {
    try { triggerData = JSON.parse(row.trigger_data) as Record<string, unknown> } catch { triggerData = {} }
  }
  let outcomeData: Record<string, unknown> | null = null
  if (row.outcome_data) {
    try { outcomeData = JSON.parse(row.outcome_data) as Record<string, unknown> } catch { outcomeData = null }
  }
  return {
    id: row.id,
    autonomousId: row.autonomous_id,
    autonomousType: row.autonomous_type as AtcAutonomousEvolutionType,
    status: row.status as AtcAutonomousEvolutionStatus,
    ownerServerId: row.owner_server_id,
    autonomousNonce: row.autonomous_nonce,
    triggerData,
    outcomeData,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AutonomousEvolutionRepository {
  constructor(private readonly pool: EvolutionRuntimePool) {}

  async create(params: CreateAutonomousEvolutionParams): Promise<AtcAutonomousEvolution> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const autonomousId = generateId()
      const triggerDataJson = JSON.stringify(params.triggerData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_autonomous_evolution
             (id, autonomous_id, autonomous_type, status, owner_server_id, autonomous_nonce,
              trigger_data, outcome_data, applied_at, created_at, updated_at)
           VALUES (?, ?, ?, 'triggered', ?, ?, ?, NULL, NULL, NOW(3), NOW(3))`,
          [id, autonomousId, params.autonomousType, params.ownerServerId,
           params.autonomousNonce, triggerDataJson] as string[],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateAutonomousEvolutionError(params.autonomousNonce)
        throw err
      }

      const [rows] = await conn.execute<AutonomousEvolutionRow[]>(
        `SELECT id, autonomous_id, autonomous_type, status, owner_server_id, autonomous_nonce,
                trigger_data, outcome_data, applied_at, created_at, updated_at
         FROM atc_autonomous_evolution WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new AutonomousEvolutionNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcAutonomousEvolution | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AutonomousEvolutionRow[]>(
        `SELECT id, autonomous_id, autonomous_type, status, owner_server_id, autonomous_nonce,
                trigger_data, outcome_data, applied_at, created_at, updated_at
         FROM atc_autonomous_evolution WHERE id = ? LIMIT 1`,
        [id],
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
    status: AtcAutonomousEvolutionStatus,
    appliedAt?: Date | undefined,
    outcomeData?: Record<string, unknown> | undefined,
  ): Promise<AtcAutonomousEvolution> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<AutonomousEvolutionRow[]>(
          `SELECT id FROM atc_autonomous_evolution WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new AutonomousEvolutionNotFoundError(id)

        if (appliedAt !== undefined && outcomeData !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_evolution
             SET status = ?, applied_at = ?, outcome_data = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, appliedAt.toISOString().replace('T', ' ').replace('Z', ''), JSON.stringify(outcomeData), id] as string[],
          )
        } else if (appliedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_evolution SET status = ?, applied_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, appliedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[],
          )
        } else if (outcomeData !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_evolution SET status = ?, outcome_data = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, JSON.stringify(outcomeData), id] as string[],
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_autonomous_evolution SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id],
          )
        }

        const [rows] = await conn.execute<AutonomousEvolutionRow[]>(
          `SELECT id, autonomous_id, autonomous_type, status, owner_server_id, autonomous_nonce,
                  trigger_data, outcome_data, applied_at, created_at, updated_at
           FROM atc_autonomous_evolution WHERE id = ? LIMIT 1`,
          [id],
        )
        const row = rows[0]
        if (!row) throw new AutonomousEvolutionNotFoundError(id)
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
        `DELETE FROM atc_autonomous_evolution
         WHERE status IN ('applied', 'failed', 'reverted')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
