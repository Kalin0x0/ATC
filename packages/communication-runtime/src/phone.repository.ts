import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'

// ── Messages ─────────────────────────────────────────────────────────────────

export interface AtcPhoneMessage {
  id: string
  fromCharacterId: string
  toCharacterId: string
  body: string
  readAt: Date | null
  sentAt: Date
}

interface PhoneMessageRow extends RowDataPacket {
  id: string
  from_character_id: string
  to_character_id: string
  body: string
  read_at: Date | null
  sent_at: Date
}

function mapMessage(row: PhoneMessageRow): AtcPhoneMessage {
  return {
    id: row.id,
    fromCharacterId: row.from_character_id,
    toCharacterId: row.to_character_id,
    body: row.body,
    readAt: row.read_at,
    sentAt: row.sent_at,
  }
}

export interface SendPhoneMessageParams {
  fromCharacterId: string
  toCharacterId: string
  body: string
  idempotencyKey: string
}

export interface SendPhoneMessageResult {
  message: AtcPhoneMessage
  /** True when this key had already been used and the stored message was returned. */
  idempotent: boolean
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export interface AtcPhoneContact {
  id: string
  ownerCharacterId: string
  contactCharacterId: string
  displayName: string
  createdAt: Date
  updatedAt: Date
}

interface PhoneContactRow extends RowDataPacket {
  id: string
  owner_character_id: string
  contact_character_id: string
  display_name: string
  created_at: Date
  updated_at: Date
}

function mapContact(row: PhoneContactRow): AtcPhoneContact {
  return {
    id: row.id,
    ownerCharacterId: row.owner_character_id,
    contactCharacterId: row.contact_character_id,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface UpsertPhoneContactParams {
  ownerCharacterId: string
  contactCharacterId: string
  displayName: string
}

type SqlArgs = (string | number | boolean | null)[]

/**
 * Phone messaging: direct messages between characters and the contact list
 * behind them. Separate from the radio system in this package — that is
 * tactical comms between units, this is a character's phone.
 */
export class PhoneRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

  /**
   * Store a message. Idempotent on idempotencyKey: sending the same key twice
   * returns the stored message rather than delivering it again, so a retried
   * request cannot double-send.
   */
  async sendMessage(params: SendPhoneMessageParams): Promise<SendPhoneMessageResult> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT IGNORE INTO atc_phone_messages
           (id, from_character_id, to_character_id, body, idempotency_key, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [id, params.fromCharacterId, params.toCharacterId, params.body, params.idempotencyKey] as SqlArgs,
      )

      // affectedRows === 0 means the unique key already existed.
      const idempotent = result.affectedRows === 0
      const [rows] = await conn.query<PhoneMessageRow[]>(
        `SELECT id, from_character_id, to_character_id, body, read_at, sent_at
           FROM atc_phone_messages
          WHERE idempotency_key = ?`,
        [params.idempotencyKey] as SqlArgs,
      )
      const row = rows[0]
      if (row === undefined) {
        // Only reachable if the row vanished between insert and select.
        throw new Error('Phone message could not be stored')
      }
      return { message: mapMessage(row), idempotent }
    } finally {
      conn.release()
    }
  }

  /**
   * Messages exchanged between two characters, newest first. Both directions,
   * so a client renders one conversation rather than two half-threads.
   */
  async listConversation(
    characterId: string,
    withCharacterId: string,
    limit: number,
    offset: number,
  ): Promise<AtcPhoneMessage[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<PhoneMessageRow[]>(
        `SELECT id, from_character_id, to_character_id, body, read_at, sent_at
           FROM atc_phone_messages
          WHERE (from_character_id = ? AND to_character_id = ?)
             OR (from_character_id = ? AND to_character_id = ?)
          ORDER BY sent_at DESC
          LIMIT ? OFFSET ?`,
        [characterId, withCharacterId, withCharacterId, characterId, limit, offset] as SqlArgs,
      )
      return rows.map(mapMessage)
    } finally {
      conn.release()
    }
  }

  /** Everything addressed to this character, newest first. */
  async listInbox(characterId: string, limit: number, offset: number): Promise<AtcPhoneMessage[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<PhoneMessageRow[]>(
        `SELECT id, from_character_id, to_character_id, body, read_at, sent_at
           FROM atc_phone_messages
          WHERE to_character_id = ?
          ORDER BY sent_at DESC
          LIMIT ? OFFSET ?`,
        [characterId, limit, offset] as SqlArgs,
      )
      return rows.map(mapMessage)
    } finally {
      conn.release()
    }
  }

  /**
   * Mark this character's messages from one sender as read.
   * Scoped to the recipient so a character cannot mark someone else's mail read.
   * @returns number of messages affected
   */
  async markConversationRead(characterId: string, fromCharacterId: string): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_phone_messages
            SET read_at = NOW(3)
          WHERE to_character_id = ? AND from_character_id = ? AND read_at IS NULL`,
        [characterId, fromCharacterId] as SqlArgs,
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }

  /** Number of unread messages addressed to this character. */
  async countUnread(characterId: string): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<(RowDataPacket & { cnt: number })[]>(
        `SELECT COUNT(*) AS cnt
           FROM atc_phone_messages
          WHERE to_character_id = ? AND read_at IS NULL`,
        [characterId] as SqlArgs,
      )
      return rows[0]?.cnt ?? 0
    } finally {
      conn.release()
    }
  }

  /** A character's contact list, alphabetical by the name they gave it. */
  async listContacts(ownerCharacterId: string): Promise<AtcPhoneContact[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<PhoneContactRow[]>(
        `SELECT id, owner_character_id, contact_character_id, display_name,
                created_at, updated_at
           FROM atc_phone_contacts
          WHERE owner_character_id = ?
          ORDER BY display_name ASC`,
        [ownerCharacterId] as SqlArgs,
      )
      return rows.map(mapContact)
    } finally {
      conn.release()
    }
  }

  /**
   * Add a contact, or rename it when the pair already exists. Re-adding is a
   * rename rather than an error: a phone that refuses a duplicate is annoying,
   * and the unique key already guarantees one row per pair.
   */
  async upsertContact(params: UpsertPhoneContactParams): Promise<AtcPhoneContact> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_phone_contacts
           (id, owner_character_id, contact_character_id, display_name)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)`,
        [generateId(), params.ownerCharacterId, params.contactCharacterId, params.displayName] as SqlArgs,
      )
      const [rows] = await conn.query<PhoneContactRow[]>(
        `SELECT id, owner_character_id, contact_character_id, display_name,
                created_at, updated_at
           FROM atc_phone_contacts
          WHERE owner_character_id = ? AND contact_character_id = ?`,
        [params.ownerCharacterId, params.contactCharacterId] as SqlArgs,
      )
      const row = rows[0]
      if (row === undefined) throw new Error('Phone contact could not be stored')
      return mapContact(row)
    } finally {
      conn.release()
    }
  }

  /**
   * Remove a contact. Scoped to the owner so one character cannot delete
   * another's entries.
   * @returns true when a row was removed
   */
  async removeContact(ownerCharacterId: string, contactCharacterId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_phone_contacts
          WHERE owner_character_id = ? AND contact_character_id = ?`,
        [ownerCharacterId, contactCharacterId] as SqlArgs,
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }
}
