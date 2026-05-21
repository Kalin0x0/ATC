import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { EvolutionRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { EvolutionRuntimeNotFoundError, DuplicateEvolutionRuntimeError } from './errors.js'

export type AtcEvolutionRuntimeType = 'schema' | 'behavior' | 'protocol' | 'topology' | 'config' | 'custom'
export type AtcEvolutionRuntimeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'rolled_back'

export interface AtcRuntimeEvolution {
  id: string
  evolutionId: string
  evolutionType: AtcEvolutionRuntimeType
  status: AtcEvolutionRuntimeStatus
  ownerServerId: string
  evolutionNonce: string
  evolutionData: Record<string, unknown>
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateRuntimeEvolutionParams {
  evolutionType: AtcEvolutionRuntimeType
  ownerServerId: string
  evolutionNonce: string
  evolutionData?: Record<string, unknown> | undefined
}

interface RuntimeEvolutionRow extends RowDataPacket {
  id: string
  evolution_id: string
  evolution_type: string
  status: string
  owner_server_id: string
  evolution_nonce: string
  evolution_data: string | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeEvolutionRow): AtcRuntimeEvolution {
  let evolutionData: Record<string, unknown> = {}
  if (row.evolution_data) {
    try { evolutionData = JSON.parse(row.evolution_data) as Record<string, unknown> } catch { evolutionData = {} }
  }
  return {
    id: row.id,
    evolutionId: row.evolution_id,
    evolutionType: row.evolution_type as AtcEvolutionRuntimeType,
    status: row.status as AtcEvolutionRuntimeStatus,
    ownerServerId: row.owner_server_id,
    evolutionNonce: row.evolution_nonce,
    evolutionData,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeEvolutionRepository {
  constructor(private readonly pool: EvolutionRuntimePool) {}

  async create(params: CreateRuntimeEvolutionParams): Promise<AtcRuntimeEvolution> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const evolutionId = generateId()
      const evolutionDataJson = JSON.stringify(params.evolutionData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_evolution
             (id, evolution_id, evolution_type, status, owner_server_id, evolution_nonce,
              evolution_data, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, evolutionId, params.evolutionType, params.ownerServerId,
           params.evolutionNonce, evolutionDataJson] as string[],
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateEvolutionRuntimeError(params.evolutionNonce)
        throw err
      }

      const [rows] = await conn.execute<RuntimeEvolutionRow[]>(
        `SELECT id, evolution_id, evolution_type, status, owner_server_id, evolution_nonce,
                evolution_data, completed_at, created_at, updated_at
         FROM atc_runtime_evolution WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) throw new EvolutionRuntimeNotFoundError(id)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeEvolution | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeEvolutionRow[]>(
        `SELECT id, evolution_id, evolution_type, status, owner_server_id, evolution_nonce,
                evolution_data, completed_at, created_at, updated_at
         FROM atc_runtime_evolution WHERE id = ? LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcEvolutionRuntimeStatus, completedAt?: Date | undefined): Promise<AtcRuntimeEvolution> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeEvolutionRow[]>(
          `SELECT id FROM atc_runtime_evolution WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const lockRow = lockRows[0]
        if (!lockRow) throw new EvolutionRuntimeNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_evolution SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[],
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_evolution SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id],
          )
        }

        const [rows] = await conn.execute<RuntimeEvolutionRow[]>(
          `SELECT id, evolution_id, evolution_type, status, owner_server_id, evolution_nonce,
                  evolution_data, completed_at, created_at, updated_at
           FROM atc_runtime_evolution WHERE id = ? LIMIT 1`,
          [id],
        )
        const row = rows[0]
        if (!row) throw new EvolutionRuntimeNotFoundError(id)
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
        `DELETE FROM atc_runtime_evolution
         WHERE status IN ('completed', 'failed', 'rolled_back')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
