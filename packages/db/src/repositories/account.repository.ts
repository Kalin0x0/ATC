import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import type { AtcAccountStatus, AtcLocaleCode } from '@atc/shared-types'
import { generateId } from '../id.js'

interface AccountRow extends RowDataPacket {
  id: string
  primary_identifier: string
  preferred_language: string
  status: string
  created_at: Date
  updated_at: Date
}

interface IdentifierRow extends RowDataPacket {
  identifier: string
  identifier_type: string
}

export interface AccountRecord {
  id: string
  primaryIdentifier: string
  identifiers: Record<string, string>
  preferredLanguage: AtcLocaleCode
  status: AtcAccountStatus
  createdAt: Date
  updatedAt: Date
}

export class AccountRepository {
  constructor(private readonly pool: DbPool) {}

  // Looks up by primary_identifier (the canonical lookup key, e.g. "license:abc123")
  async findByIdentifier(primaryIdentifier: string): Promise<AccountRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AccountRow[]>(
        `SELECT id, primary_identifier, preferred_language, status, created_at, updated_at
         FROM atc_accounts
         WHERE primary_identifier = ?
         LIMIT 1`,
        [primaryIdentifier]
      )
      const row = rows[0]
      if (!row) return null

      const [idRows] = await conn.execute<IdentifierRow[]>(
        'SELECT identifier_type, identifier FROM atc_account_identifiers WHERE account_id = ?',
        [row.id]
      )
      const identifiers: Record<string, string> = {}
      for (const r of idRows) {
        identifiers[r.identifier_type] = r.identifier
      }

      return {
        id: row.id,
        primaryIdentifier: row.primary_identifier,
        identifiers,
        preferredLanguage: row.preferred_language as AtcLocaleCode,
        status: row.status as AtcAccountStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    } finally {
      conn.release()
    }
  }

  // Atomic upsert: INSERT ... ON DUPLICATE KEY UPDATE prevents TOCTOU races.
  // primary_identifier has a UNIQUE constraint, so concurrent inserts safely collapse.
  async upsert(params: {
    primaryIdentifier: string
    identifiers: Record<string, string>
    preferredLanguage: AtcLocaleCode
  }): Promise<{ id: string; created: boolean; status: AtcAccountStatus }> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Generate a candidate ID — only used if this is a new row
      const candidateId = generateId()

      // Atomic upsert: INSERT or update preferred_language on conflict
      const [upsertResult] = await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_accounts
           (id, primary_identifier, preferred_language, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           preferred_language = VALUES(preferred_language),
           updated_at = NOW(3)`,
        [candidateId, params.primaryIdentifier, params.preferredLanguage]
      )

      // affectedRows=1 → INSERT, affectedRows=2 → UPDATE (MariaDB convention)
      const created = upsertResult.affectedRows === 1

      // Fetch the actual account ID (may differ from candidateId if it already existed)
      const [rows] = await conn.execute<AccountRow[]>(
        'SELECT id, status FROM atc_accounts WHERE primary_identifier = ?',
        [params.primaryIdentifier]
      )
      const row = rows[0]
      if (!row) throw new Error(`Account not found after upsert: ${params.primaryIdentifier}`)

      const accountId = row.id
      const status = row.status as AtcAccountStatus

      // Upsert all identifiers
      for (const [type, value] of Object.entries(params.identifiers)) {
        await conn.execute(
          `INSERT INTO atc_account_identifiers (account_id, identifier_type, identifier)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE identifier = VALUES(identifier)`,
          [accountId, type, value]
        )
      }

      await conn.commit()
      return { id: accountId, created, status }
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async getStatus(primaryIdentifier: string): Promise<AtcAccountStatus | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AccountRow[]>(
        'SELECT status FROM atc_accounts WHERE primary_identifier = ? LIMIT 1',
        [primaryIdentifier]
      )
      const row = rows[0]
      if (!row) return null
      return row.status as AtcAccountStatus
    } finally {
      conn.release()
    }
  }

  async getStatusById(accountId: string): Promise<AtcAccountStatus | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AccountRow[]>(
        'SELECT status FROM atc_accounts WHERE id = ? LIMIT 1',
        [accountId]
      )
      const row = rows[0]
      if (!row) return null
      return row.status as AtcAccountStatus
    } finally {
      conn.release()
    }
  }
}
