import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import { generateId } from '../id.js'

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

  /**
   * Record a ban. expiresAt null is permanent.
   *
   * The account's own status is not touched here: findActiveByAccountId is what
   * the connect check reads, and it already answers from this table. Writing
   * both would leave two sources of truth to disagree once a ban expires — the
   * row expires on its own, an account status would not.
   */
  async create(params: {
    accountId: string
    reason: string
    expiresAt?: Date | null
    bannedBy?: string | null
  }): Promise<BanRecord> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_bans (id, account_id, reason, expires_at, is_active, banned_by)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [id, params.accountId, params.reason, params.expiresAt ?? null, params.bannedBy ?? null]
      )
      const [rows] = await conn.execute<BanRow[]>(
        `SELECT id, account_id, reason, expires_at, created_at FROM atc_bans WHERE id = ?`,
        [id]
      )
      const row = rows[0]
      if (!row) throw new Error(`Ban could not be stored: ${id}`)
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

  /**
   * Lift a ban. Deactivates rather than deletes, so the record of the ban and
   * of it having been lifted both survive.
   * @returns true when an active ban was lifted
   */
  async revoke(banId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_bans SET is_active = 0 WHERE id = ? AND is_active = 1`,
        [banId]
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  /** Every ban on an account, newest first, lifted and expired ones included. */
  async listByAccountId(accountId: string, limit = 50): Promise<BanRecord[]> {
    // Inlined rather than bound: MySQL 8 rejects a placeholder in LIMIT over the
    // prepared-statement protocol where MariaDB accepts it. Clamped to an
    // integer here, so nothing but a number ever reaches the statement.
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || 0, 1), 500)
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<BanRow[]>(
        `SELECT id, account_id, reason, expires_at, created_at
         FROM atc_bans
         WHERE account_id = ?
         ORDER BY created_at DESC
         LIMIT ${safeLimit}`,
        [accountId]
      )
      return rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        reason: row.reason,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      }))
    } finally {
      conn.release()
    }
  }
}
