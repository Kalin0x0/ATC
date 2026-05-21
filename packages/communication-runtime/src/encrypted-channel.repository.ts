import type { RowDataPacket } from 'mysql2'
import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { EncryptedChannelNotFoundError } from './errors.js'

export interface AtcEncryptedChannel {
  id: string
  channelId: string
  encryptionKeyHash: string
  keyRotatedAt: Date
  createdAt: Date
  updatedAt: Date
}

interface EncryptedChannelRow extends RowDataPacket {
  id: string
  channel_id: string
  encryption_key_hash: string
  key_rotated_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: EncryptedChannelRow): AtcEncryptedChannel {
  return {
    id: row.id,
    channelId: row.channel_id,
    encryptionKeyHash: row.encryption_key_hash,
    keyRotatedAt: row.key_rotated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class EncryptedChannelRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

  async findByChannelId(channelId: string): Promise<AtcEncryptedChannel | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<EncryptedChannelRow[]>(
        `SELECT id, channel_id, encryption_key_hash, key_rotated_at, created_at, updated_at
         FROM atc_encrypted_channels
         WHERE channel_id = ?`,
        [channelId] as (string | number | boolean | null)[],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async upsert(channelId: string, encryptionKeyHash: string): Promise<AtcEncryptedChannel> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        channelId,
        encryptionKeyHash,
        encryptionKeyHash,
      ]
      await conn.execute(
        `INSERT INTO atc_encrypted_channels
           (id, channel_id, encryption_key_hash, key_rotated_at)
         VALUES (?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE
           encryption_key_hash = ?,
           key_rotated_at = NOW(3),
           updated_at = NOW(3)`,
        binds,
      )
      const channel = await this.findByChannelId(channelId)
      if (channel === null) {
        throw new Error(`Failed to retrieve encrypted channel after upsert: ${channelId}`)
      }
      return channel
    } finally {
      conn.release()
    }
  }

  async deleteByChannelId(channelId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const existing = await this.findByChannelId(channelId)
      if (existing === null) {
        throw new EncryptedChannelNotFoundError(channelId)
      }
      await conn.execute(
        `DELETE FROM atc_encrypted_channels WHERE channel_id = ?`,
        [channelId] as (string | number | boolean | null)[],
      )
    } finally {
      conn.release()
    }
  }
}
