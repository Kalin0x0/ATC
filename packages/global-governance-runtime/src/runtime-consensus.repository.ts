import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GlobalGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { ConsensusNotFoundError } from './errors.js'

export type AtcConsensusType = 'raft' | 'paxos' | 'bft' | 'simple_majority' | 'unanimous' | 'custom'
export type AtcConsensusStatus = 'proposed' | 'voting' | 'committed' | 'aborted' | 'expired'

export interface AtcRuntimeConsensus {
  id: string
  consensusId: string
  consensusType: AtcConsensusType
  status: AtcConsensusStatus
  ownerServerId: string
  consensusNonce: string
  consensusData: Record<string, unknown>
  committedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateConsensusParams {
  consensusType: AtcConsensusType
  ownerServerId: string
  consensusNonce: string
  consensusData?: Record<string, unknown> | undefined
}

interface RuntimeConsensusRow extends RowDataPacket {
  id: string
  consensus_id: string
  consensus_type: string
  status: string
  owner_server_id: string
  consensus_nonce: string
  consensus_data: string | null
  committed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RuntimeConsensusRow): AtcRuntimeConsensus {
  let consensusData: Record<string, unknown> = {}
  if (row.consensus_data) {
    try {
      consensusData = JSON.parse(row.consensus_data) as Record<string, unknown>
    } catch {
      consensusData = {}
    }
  }
  return {
    id: row.id,
    consensusId: row.consensus_id,
    consensusType: row.consensus_type as AtcConsensusType,
    status: row.status as AtcConsensusStatus,
    ownerServerId: row.owner_server_id,
    consensusNonce: row.consensus_nonce,
    consensusData,
    committedAt: row.committed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeConsensusRepository {
  constructor(private readonly pool: GlobalGovernancePool) {}

  async create(params: CreateConsensusParams): Promise<AtcRuntimeConsensus> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const consensusId = generateId()
      const consensusDataJson = JSON.stringify(params.consensusData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_consensus
           (id, consensus_id, consensus_type, status, owner_server_id, consensus_nonce,
            consensus_data, committed_at, created_at, updated_at)
         VALUES (?, ?, ?, 'proposed', ?, ?, ?, NULL, NOW(3), NOW(3))`,
        [
          id,
          consensusId,
          params.consensusType,
          params.ownerServerId,
          params.consensusNonce,
          consensusDataJson,
        ] as (string | number | boolean | null)[]
      )

      const [rows] = await conn.execute<RuntimeConsensusRow[]>(
        `SELECT id, consensus_id, consensus_type, status, owner_server_id, consensus_nonce,
                consensus_data, committed_at, created_at, updated_at
         FROM atc_runtime_consensus
         WHERE id = ?
         LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Runtime consensus record not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeConsensus | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<RuntimeConsensusRow[]>(
        `SELECT id, consensus_id, consensus_type, status, owner_server_id, consensus_nonce,
                consensus_data, committed_at, created_at, updated_at
         FROM atc_runtime_consensus
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
    status: AtcConsensusStatus,
    committedAt?: Date | undefined
  ): Promise<AtcRuntimeConsensus> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<RuntimeConsensusRow[]>(
          `SELECT id, consensus_id, consensus_type, status, owner_server_id, consensus_nonce,
                  consensus_data, committed_at, created_at, updated_at
           FROM atc_runtime_consensus
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new ConsensusNotFoundError(id)

        if (committedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_consensus
             SET status = ?, committed_at = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [
              status,
              committedAt.toISOString().replace('T', ' ').replace('Z', ''),
              id,
            ] as (string | number | boolean | null)[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_consensus
             SET status = ?, updated_at = NOW(3)
             WHERE id = ?`,
            [status, id] as (string | number | boolean | null)[]
          )
        }

        const [rows] = await conn.execute<RuntimeConsensusRow[]>(
          `SELECT id, consensus_id, consensus_type, status, owner_server_id, consensus_nonce,
                  consensus_data, committed_at, created_at, updated_at
           FROM atc_runtime_consensus
           WHERE id = ?
           LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new ConsensusNotFoundError(id)

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
        `DELETE FROM atc_runtime_consensus
         WHERE status IN ('committed', 'aborted', 'expired')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
