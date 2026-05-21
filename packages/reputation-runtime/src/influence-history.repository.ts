import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import type { ReputationRuntimePool } from './pool.js'

export type AtcInfluenceChangeType =
  | 'gain'
  | 'loss'
  | 'decay'
  | 'reset'
  | 'transfer'
  | 'event'

export interface AtcInfluenceHistory {
  id: string
  principalId: string
  factionId: string | null
  changeAmount: number
  changeReason: string
  changeType: AtcInfluenceChangeType
  actorId: string | null
  createdAt: Date
}

interface InfluenceHistoryRow extends RowDataPacket {
  id: string
  principal_id: string
  faction_id: string | null
  change_amount: number
  change_reason: string
  change_type: string
  actor_id: string | null
  created_at: Date
}

function mapRow(row: InfluenceHistoryRow): AtcInfluenceHistory {
  return {
    id: row.id,
    principalId: row.principal_id,
    factionId: row.faction_id ?? null,
    changeAmount: Number(row.change_amount),
    changeReason: row.change_reason,
    changeType: row.change_type as AtcInfluenceChangeType,
    actorId: row.actor_id ?? null,
    createdAt: new Date(row.created_at),
  }
}

export class InfluenceHistoryRepository {
  constructor(private readonly pool: ReputationRuntimePool) {}

  async record(
    principalId: string,
    changeAmount: number,
    changeType: AtcInfluenceChangeType,
    changeReason: string,
    factionId?: string,
    actorId?: string,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute<InfluenceHistoryRow[]>(
        `INSERT INTO atc_influence_history
           (id, principal_id, faction_id, change_amount, change_reason, change_type, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          principalId,
          factionId ?? null,
          changeAmount,
          changeReason,
          changeType,
          actorId ?? null,
        ],
      )
    } finally {
      conn.release()
    }
  }

  async listByPrincipal(
    principalId: string,
    limit = 50,
  ): Promise<AtcInfluenceHistory[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfluenceHistoryRow[]>(
        'SELECT * FROM atc_influence_history WHERE principal_id = ? ORDER BY created_at DESC LIMIT ?',
        [principalId, limit],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listByPrincipalAndFaction(
    principalId: string,
    factionId: string,
    limit = 50,
  ): Promise<AtcInfluenceHistory[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfluenceHistoryRow[]>(
        'SELECT * FROM atc_influence_history WHERE principal_id = ? AND faction_id = ? ORDER BY created_at DESC LIMIT ?',
        [principalId, factionId, limit],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
