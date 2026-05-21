import type { RowDataPacket } from 'mysql2/promise'
import type { NpcRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcNpcBehavior {
  id: string
  npcId: string
  behavior: string
  params: Record<string, unknown>
  startedAt: Date
  endedAt: Date | null
  createdAt: Date
}

interface NpcBehaviorRow extends RowDataPacket {
  id: string
  npc_id: string
  behavior: string
  params: string
  started_at: Date
  ended_at: Date | null
  created_at: Date
}

function rowToBehavior(row: NpcBehaviorRow): AtcNpcBehavior {
  return {
    id: row.id,
    npcId: row.npc_id,
    behavior: row.behavior,
    params: JSON.parse(row.params) as Record<string, unknown>,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  }
}

export class NpcBehaviorRepository {
  constructor(private readonly pool: NpcRuntimePool) {}

  async record(
    npcId: string,
    behavior: string,
    params?: Record<string, unknown> | undefined,
  ): Promise<AtcNpcBehavior> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_npc_behaviors
           (id, npc_id, behavior, params, started_at, created_at)
         VALUES (?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, npcId, behavior, JSON.stringify(params ?? {})],
      )
      const [rows] = await conn.execute<NpcBehaviorRow[]>(
        `SELECT * FROM atc_npc_behaviors WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) {
        throw new Error(`Behavior record not found after insert: ${id}`)
      }
      return rowToBehavior(rows[0])
    } finally {
      conn.release()
    }
  }

  async findCurrentByNpc(npcId: string): Promise<AtcNpcBehavior | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<NpcBehaviorRow[]>(
        `SELECT * FROM atc_npc_behaviors
         WHERE npc_id = ? AND ended_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [npcId],
      )
      return rows[0] ? rowToBehavior(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async endCurrent(npcId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_npc_behaviors
         SET ended_at = NOW(3)
         WHERE npc_id = ? AND ended_at IS NULL`,
        [npcId],
      )
    } finally {
      conn.release()
    }
  }

  async listByNpc(npcId: string, limit?: number | undefined): Promise<AtcNpcBehavior[]> {
    const conn = await this.pool.getConnection()
    try {
      const effectiveLimit = limit ?? 50
      const [rows] = await conn.execute<NpcBehaviorRow[]>(
        `SELECT * FROM atc_npc_behaviors
         WHERE npc_id = ?
         ORDER BY started_at DESC
         LIMIT ?`,
        [npcId, effectiveLimit],
      )
      return rows.map(rowToBehavior)
    } finally {
      conn.release()
    }
  }
}
