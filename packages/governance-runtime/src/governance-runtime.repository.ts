import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { GovernanceRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateGovernanceError, GovernanceNotFoundError } from './errors.js'

export type AtcGovernanceType = 'democracy' | 'oligarchy' | 'autocracy' | 'federation' | 'custom'
export type AtcGovernanceStatus = 'active' | 'suspended' | 'dissolved' | 'transitioning'

export interface AtcGovernanceRuntime {
  id: string
  governanceId: string
  governanceType: AtcGovernanceType
  status: AtcGovernanceStatus
  ownerServerId: string
  regionId: string | null
  governanceNonce: string
  governanceData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface GovernanceRuntimeRow extends RowDataPacket {
  id: string
  governance_id: string
  governance_type: string
  status: string
  owner_server_id: string
  region_id: string | null
  governance_nonce: string
  governance_data: string
  created_at: Date
  updated_at: Date
}

function mapRow(row: GovernanceRuntimeRow): AtcGovernanceRuntime {
  let governanceData: Record<string, unknown> = {}
  try {
    governanceData = JSON.parse(row.governance_data) as Record<string, unknown>
  } catch {
    governanceData = {}
  }
  return {
    id: row.id,
    governanceId: row.governance_id,
    governanceType: row.governance_type as AtcGovernanceType,
    status: row.status as AtcGovernanceStatus,
    ownerServerId: row.owner_server_id,
    regionId: row.region_id,
    governanceNonce: row.governance_nonce,
    governanceData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateGovernanceParams {
  governanceId: string
  governanceType: AtcGovernanceType
  ownerServerId: string
  regionId?: string | null | undefined
  governanceNonce: string
  governanceData?: Record<string, unknown> | undefined
}

export class GovernanceRuntimeRepository {
  constructor(private readonly pool: GovernanceRuntimePool) {}

  async create(params: CreateGovernanceParams): Promise<AtcGovernanceRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const governanceDataJson = JSON.stringify(params.governanceData ?? {})
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_governance_runtime
             (id, governance_id, governance_type, status, owner_server_id, region_id,
              governance_nonce, governance_data, created_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NOW(3), NOW(3))`,
          [
            id,
            params.governanceId,
            params.governanceType,
            params.ownerServerId,
            params.regionId ?? null,
            params.governanceNonce,
            governanceDataJson,
          ],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateGovernanceError(params.governanceId)
        }
        throw err
      }
      const [rows] = await conn.execute<GovernanceRuntimeRow[]>(
        `SELECT id, governance_id, governance_type, status, owner_server_id, region_id,
                governance_nonce, governance_data, created_at, updated_at
         FROM atc_governance_runtime
         WHERE id = ?
         LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new Error(`Governance not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcGovernanceRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GovernanceRuntimeRow[]>(
        `SELECT id, governance_id, governance_type, status, owner_server_id, region_id,
                governance_nonce, governance_data, created_at, updated_at
         FROM atc_governance_runtime
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

  async updateStatus(id: string, status: AtcGovernanceStatus): Promise<AtcGovernanceRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<GovernanceRuntimeRow[]>(
          `SELECT id, governance_id, governance_type, status, owner_server_id, region_id,
                  governance_nonce, governance_data, created_at, updated_at
           FROM atc_governance_runtime
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new GovernanceNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_governance_runtime
           SET status = ?, updated_at = NOW(3)
           WHERE id = ?`,
          [status, id],
        )

        const [updated] = await conn.execute<GovernanceRuntimeRow[]>(
          `SELECT id, governance_id, governance_type, status, owner_server_id, region_id,
                  governance_nonce, governance_data, created_at, updated_at
           FROM atc_governance_runtime
           WHERE id = ?
           LIMIT 1`,
          [id],
        )
        if (!updated[0]) throw new GovernanceNotFoundError(id)

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

  async listActive(ownerServerId?: string): Promise<AtcGovernanceRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      if (ownerServerId !== undefined) {
        const [rows] = await conn.execute<GovernanceRuntimeRow[]>(
          `SELECT id, governance_id, governance_type, status, owner_server_id, region_id,
                  governance_nonce, governance_data, created_at, updated_at
           FROM atc_governance_runtime
           WHERE status = 'active' AND owner_server_id = ?
           ORDER BY created_at ASC`,
          [ownerServerId],
        )
        return rows.map(mapRow)
      } else {
        const [rows] = await conn.execute<GovernanceRuntimeRow[]>(
          `SELECT id, governance_id, governance_type, status, owner_server_id, region_id,
                  governance_nonce, governance_data, created_at, updated_at
           FROM atc_governance_runtime
           WHERE status = 'active'
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
        `DELETE FROM atc_governance_runtime
         WHERE status IN ('dissolved', 'suspended')
           AND updated_at < ?`,
        [thresholdDate],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
