import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import type { AtcGender, AtcCharacterStatus } from '@atc/shared-types'
import { generateId } from '../id.js'

const MAX_CHARACTERS_PER_ACCOUNT = 5

interface CharacterRow extends RowDataPacket {
  id: string
  account_id: string
  slot: number | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string
  nationality: string | null
  metadata: string | null
  status: string
  created_at: Date
  updated_at: Date
}

export interface CharacterRecord {
  id: string
  accountId: string
  slot: number | null
  firstName: string
  lastName: string
  dateOfBirth: string | null
  gender: AtcGender
  nationality: string | null
  metadata: Record<string, unknown>
  status: AtcCharacterStatus
  createdAt: Date
  updatedAt: Date
}

function rowToCharacter(row: CharacterRow): CharacterRecord {
  let metadata: Record<string, unknown> = {}
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>
    } catch {
      metadata = {}
    }
  }
  return {
    id: row.id,
    accountId: row.account_id,
    slot: row.slot,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender as AtcGender,
    nationality: row.nationality,
    metadata,
    status: row.status as AtcCharacterStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type ConnType = Awaited<ReturnType<DbPool['getConnection']>>

export class CharacterRepository {
  constructor(private readonly pool: DbPool) {}

  async create(params: {
    accountId: string
    slot: number
    firstName: string
    lastName: string
    gender: AtcGender
    dateOfBirth?: string
    nationality?: string
    metadata?: Record<string, unknown>
  }): Promise<CharacterRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Lock the account row to serialize concurrent character creates for the same account.
      // Any other transaction trying to create a character for the same account will wait here.
      await conn.execute('SELECT id FROM atc_accounts WHERE id = ? FOR UPDATE', [params.accountId])

      const count = await this._countActive(params.accountId, conn)
      if (count >= MAX_CHARACTERS_PER_ACCOUNT) {
        await conn.rollback()
        throw new CharacterLimitError(
          `Account ${params.accountId} has reached the maximum of ${MAX_CHARACTERS_PER_ACCOUNT} characters`
        )
      }

      const id = generateId()
      const metadataJson = params.metadata ? JSON.stringify(params.metadata) : null

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_characters
             (id, account_id, slot, first_name, last_name, gender, date_of_birth, nationality, metadata, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(3), NOW(3))`,
          [
            id,
            params.accountId,
            params.slot,
            params.firstName,
            params.lastName,
            params.gender,
            params.dateOfBirth ?? null,
            params.nationality ?? null,
            metadataJson,
          ]
        )
      } catch (err: unknown) {
        await conn.rollback()
        if (isMysqlDuplicateError(err)) {
          throw new CharacterSlotTakenError(
            `Slot ${params.slot} is already in use for account ${params.accountId}`
          )
        }
        throw err
      }

      const [rows] = await conn.execute<CharacterRow[]>(
        'SELECT * FROM atc_characters WHERE id = ?',
        [id]
      )
      const row = rows[0]
      if (!row) {
        await conn.rollback()
        throw new Error(`Character not found after insert: ${id}`)
      }

      await conn.commit()
      return rowToCharacter(row)
    } catch (err) {
      // Rollback only if transaction is still open (errors thrown before rollback won't double-rollback)
      try { await conn.rollback() } catch { /* ignore — already rolled back or connection lost */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async listByAccount(accountId: string, statusFilter: AtcCharacterStatus = 'active'): Promise<CharacterRecord[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CharacterRow[]>(
        'SELECT * FROM atc_characters WHERE account_id = ? AND status = ? ORDER BY slot ASC',
        [accountId, statusFilter]
      )
      return rows.map(rowToCharacter)
    } finally {
      conn.release()
    }
  }

  async findById(characterId: string): Promise<CharacterRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CharacterRow[]>(
        'SELECT * FROM atc_characters WHERE id = ?',
        [characterId]
      )
      const row = rows[0]
      if (!row) return null
      return rowToCharacter(row)
    } finally {
      conn.release()
    }
  }

  async findOwnedByAccount(characterId: string, accountId: string): Promise<CharacterRecord | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<CharacterRow[]>(
        'SELECT * FROM atc_characters WHERE id = ? AND account_id = ?',
        [characterId, accountId]
      )
      const row = rows[0]
      if (!row) return null
      return rowToCharacter(row)
    } finally {
      conn.release()
    }
  }

  async countByAccount(accountId: string): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      return await this._countActive(accountId, conn)
    } finally {
      conn.release()
    }
  }

  // Soft-deletes the character and frees its slot (sets slot=NULL) so it can be reused.
  // NULL slots are treated as distinct in the UNIQUE(account_id, slot) index (MariaDB behaviour).
  async softDelete(characterId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        "UPDATE atc_characters SET status = 'deleted', slot = NULL, updated_at = NOW(3) WHERE id = ? AND status = 'active'",
        [characterId]
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  async updateStatus(characterId: string, status: AtcCharacterStatus): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        'UPDATE atc_characters SET status = ?, updated_at = NOW(3) WHERE id = ?',
        [status, characterId]
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  private async _countActive(accountId: string, conn: ConnType): Promise<number> {
    interface CountRow extends RowDataPacket { cnt: number }
    const [rows] = await conn.execute<CountRow[]>(
      "SELECT COUNT(*) AS cnt FROM atc_characters WHERE account_id = ? AND status = 'active'",
      [accountId]
    )
    const row = rows[0]
    return row ? Number(row.cnt) : 0
  }
}

export class CharacterLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterLimitError'
  }
}

export class CharacterSlotTakenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterSlotTakenError'
  }
}

function isMysqlDuplicateError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ER_DUP_ENTRY'
  )
}
