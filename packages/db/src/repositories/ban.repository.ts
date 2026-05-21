import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from '../client.js'

interface BanRow extends RowDataPacket {
  id: string
  account_id: string
  reason: string | null
  expires_at: Date | null
  created_at: Date
}

export interface BanRecord {
  id: string
  accountId: string
  reason: string | null
  expiresAt: Date | null
  createdAt: Date
}

export class BanRepository {
  constructor(private readonly pool: DbPool) {}

  async findActiveByAccountId(accountId: string): Promise<BanRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BanRow[]>(
        `SELECT id, account_id, reason, expires_at, created_at
         FROM atc_bans
         WHERE account_id = ?
           AND (expires_at IS NULL OR expires_at > NOW(3))
           AND is_active = 1
         ORDER BY created_at DESC
         LIMIT 1`,
        [accountId]
      )
      const row = rows[0]
      if (!row) return null
      return {
        id: row.id,
        accountId: row.account_id,
        reason: row.reason,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }
    } finally {
      conn.release()
    }
  }

  async hasActiveBan(accountId: string): Promise<boolean> {
    const ban = await this.findActiveByAccountId(accountId)
    return ban !== null
  }
}
