import type { RowDataPacket } from 'mysql2/promise'
import type { NpcRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcNpcCleanup {
  id: string
  npcId: string
  cleanupReason: string
  ownerServerId: string | null
  cleanedAt: Date
  createdAt: Date
}

interface NpcCleanupRow extends RowDataPacket {
  id: string
  npc_id: string
  cleanup_reason: string
  owner_server_id: string | null
  cleaned_at: Date
  created_at: Date
}

function rowToCleanup(row: NpcCleanupRow): AtcNpcCleanup {
  return {
    id: row.id,
    npcId: row.npc_id,
    cleanupReason: row.cleanup_reason,
    ownerServerId: row.owner_server_id,
    cleanedAt: row.cleaned_at,
    createdAt: row.created_at,
  }
}

export class NpcCleanupRepository {
  constructor(private readonly pool: NpcRuntimePool) {}

  async record(
    npcId: string,
    reason: string,
    ownerServerId?: string | undefined,
  ): Promise<AtcNpcCleanup> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_npc_cleanup
           (id, npc_id, cleanup_reason, owner_server_id, cleaned_at, created_at)
         VALUES (?, ?, ?, ?, NOW(3), NOW(3))`,
        [id, npcId, reason, ownerServerId ?? null],
      )
      const [rows] = await conn.execute<NpcCleanupRow[]>(
        `SELECT * FROM atc_npc_cleanup WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) {
        throw new Error(`Cleanup record not found after insert: ${id}`)
      }
      return rowToCleanup(rows[0])
    } finally {
      conn.release()
    }
  }

  async listRecent(limit?: number | undefined): Promise<AtcNpcCleanup[]> {
    const conn = await this.pool.getConnection()
    try {
      const effectiveLimit = limit ?? 100
      const [rows] = await conn.execute<NpcCleanupRow[]>(
        `SELECT * FROM atc_npc_cleanup
         ORDER BY cleaned_at DESC
         LIMIT ?`,
        [effectiveLimit],
      )
      return rows.map(rowToCleanup)
    } finally {
      conn.release()
    }
  }
}
