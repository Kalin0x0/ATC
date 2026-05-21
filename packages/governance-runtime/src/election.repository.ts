import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GovernanceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateElectionError, ElectionNotFoundError } from './errors.js'

export type AtcElectionType = 'general' | 'regional' | 'emergency' | 'referendum' | 'custom'
export type AtcElectionStatus = 'open' | 'closed' | 'cancelled' | 'counting'

export interface AtcPoliticalElection {
  id: string
  electionId: string
  electionType: AtcElectionType
  status: AtcElectionStatus
  ownerServerId: string
  regionId: string
  electionNonce: string
  candidateData: Record<string, unknown>
  resultData: Record<string, unknown> | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ElectionRow extends RowDataPacket {
  id: string
  election_id: string
  election_type: string
  status: string
  owner_server_id: string
  region_id: string
  election_nonce: string
  candidate_data: string
  result_data: string | null
  closed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ElectionRow): AtcPoliticalElection {
  let candidateData: Record<string, unknown> = {}
  try {
    candidateData = JSON.parse(row.candidate_data) as Record<string, unknown>
  } catch {
    candidateData = {}
  }
  let resultData: Record<string, unknown> | null = null
  if (row.result_data !== null) {
    try {
      resultData = JSON.parse(row.result_data) as Record<string, unknown>
    } catch {
      resultData = null
    }
  }
  return {
    id: row.id,
    electionId: row.election_id,
    electionType: row.election_type as AtcElectionType,
    status: row.status as AtcElectionStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    electionNonce: row.election_nonce,
    candidateData,
    resultData,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateElectionParams {
  electionId: string
  electionType: AtcElectionType
  ownerServerId: string
  regionId: string
  electionNonce: string
  candidateData?: Record<string, unknown> | undefined
}

export class ElectionRepository {
  constructor(private readonly pool: GovernanceRuntimePool) {}

  async create(params: CreateElectionParams): Promise<AtcPoliticalElection> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const candidateDataJson = JSON.stringify(params.candidateData ?? {})
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_political_elections
             (id, election_id, election_type, status, owner_server_id, region_id,
              election_nonce, candidate_data, result_data, closed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'open', ?, ?, ?, ?, NULL, NULL, NOW(3), NOW(3))`,
          [
            id,
            params.electionId,
            params.electionType,
            params.ownerServerId,
            params.regionId,
            params.electionNonce,
            candidateDataJson,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateElectionError(params.electionId)
        }
        throw err
      }
      const [rows] = await conn.execute<ElectionRow[]>(
        `SELECT id, election_id, election_type, status, owner_server_id, region_id,
                election_nonce, candidate_data, result_data, closed_at, created_at, updated_at
         FROM atc_political_elections
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Election not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcPoliticalElection | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ElectionRow[]>(
        `SELECT id, election_id, election_type, status, owner_server_id, region_id,
                election_nonce, candidate_data, result_data, closed_at, created_at, updated_at
         FROM atc_political_elections
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

  async updateStatus(
    id: string,
    status: AtcElectionStatus,
    closedAt?: Date,
    resultData?: Record<string, unknown>,
  ): Promise<AtcPoliticalElection> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ElectionRow[]>(
          `SELECT id, election_id, election_type, status, owner_server_id, region_id,
                  election_nonce, candidate_data, result_data, closed_at, created_at, updated_at
           FROM atc_political_elections
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new ElectionNotFoundError(id)

        const resultDataJson = resultData !== undefined ? JSON.stringify(resultData) : null
        const closedAtValue = closedAt ?? null

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_political_elections
           SET status = ?,
               closed_at = COALESCE(?, closed_at),
               result_data = COALESCE(?, result_data),
               updated_at = NOW(3)
           WHERE id = ?`,
          [status, closedAtValue, resultDataJson, id],
        )

        const [updated] = await conn.execute<ElectionRow[]>(
          `SELECT id, election_id, election_type, status, owner_server_id, region_id,
                  election_nonce, candidate_data, result_data, closed_at, created_at, updated_at
           FROM atc_political_elections
           WHERE id = ?
           LIMIT 1`,
          [id],
        )
        if (!updated[0]) throw new ElectionNotFoundError(id)

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

  async listActive(regionId?: string): Promise<AtcPoliticalElection[]> {
    const conn = await this.pool.getConnection()
    try {
      if (regionId !== undefined) {
        const [rows] = await conn.execute<ElectionRow[]>(
          `SELECT id, election_id, election_type, status, owner_server_id, region_id,
                  election_nonce, candidate_data, result_data, closed_at, created_at, updated_at
           FROM atc_political_elections
           WHERE status IN ('open', 'counting') AND region_id = ?
           ORDER BY created_at ASC`,
          [regionId],
        )
        return rows.map(mapRow)
      } else {
        const [rows] = await conn.execute<ElectionRow[]>(
          `SELECT id, election_id, election_type, status, owner_server_id, region_id,
                  election_nonce, candidate_data, result_data, closed_at, created_at, updated_at
           FROM atc_political_elections
           WHERE status IN ('open', 'counting')
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
        `DELETE FROM atc_political_elections
         WHERE status IN ('closed', 'cancelled')
           AND updated_at < ?`,
        [thresholdDate],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
