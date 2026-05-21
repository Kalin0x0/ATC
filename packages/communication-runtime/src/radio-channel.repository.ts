import type { RowDataPacket } from 'mysql2'
import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { RadioChannelAlreadyExistsError, RadioChannelNotFoundError } from './errors.js'

export type AtcChannelType = 'open' | 'encrypted' | 'emergency' | 'dispatch' | 'tactical'
export type AtcChannelStatus = 'active' | 'inactive' | 'jammed' | 'offline'

export interface AtcRadioChannel {
  id: string
  channelId: string
  channelName: string
  channelType: AtcChannelType
  frequency: number
  status: AtcChannelStatus
  ownerPrincipalId: string | null
  isEncrypted: boolean
  maxMembers: number | null
  createdAt: Date
  updatedAt: Date
}

interface RadioChannelRow extends RowDataPacket {
  id: string
  channel_id: string
  channel_name: string
  channel_type: string
  frequency: string | number
  status: string
  owner_principal_id: string | null
  is_encrypted: number
  max_members: number | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: RadioChannelRow): AtcRadioChannel {
  return {
    id: row.id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelType: row.channel_type as AtcChannelType,
    frequency: typeof row.frequency === 'string' ? parseFloat(row.frequency) : row.frequency,
    status: row.status as AtcChannelStatus,
    ownerPrincipalId: row.owner_principal_id,
    isEncrypted: row.is_encrypted === 1,
    maxMembers: row.max_members,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RadioChannelRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

  async findById(channelId: string): Promise<AtcRadioChannel | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<RadioChannelRow[]>(
        `SELECT id, channel_id, channel_name, channel_type, frequency, status,
                owner_principal_id, is_encrypted, max_members, created_at, updated_at
         FROM atc_radio_channels
         WHERE channel_id = ?`,
        [channelId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcRadioChannel[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<RadioChannelRow[]>(
        `SELECT id, channel_id, channel_name, channel_type, frequency, status,
                owner_principal_id, is_encrypted, max_members, created_at, updated_at
         FROM atc_radio_channels
         ORDER BY created_at ASC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listByType(channelType: AtcChannelType): Promise<AtcRadioChannel[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<RadioChannelRow[]>(
        `SELECT id, channel_id, channel_name, channel_type, frequency, status,
                owner_principal_id, is_encrypted, max_members, created_at, updated_at
         FROM atc_radio_channels
         WHERE channel_type = ?
         ORDER BY created_at ASC`,
        [channelType],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async create(params: {
    channelId: string
    channelName: string
    channelType: AtcChannelType
    frequency: number
    ownerPrincipalId?: string
    isEncrypted?: boolean
    maxMembers?: number
  }): Promise<AtcRadioChannel> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const binds: (string | number | boolean | null)[] = [
        id,
        params.channelId,
        params.channelName,
        params.channelType,
        params.frequency,
        params.ownerPrincipalId !== undefined ? params.ownerPrincipalId : null,
        params.isEncrypted !== undefined ? (params.isEncrypted ? 1 : 0) : 0,
        params.maxMembers !== undefined ? params.maxMembers : null,
      ]
      await conn.query(
        `INSERT INTO atc_radio_channels
           (id, channel_id, channel_name, channel_type, frequency, status,
            owner_principal_id, is_encrypted, max_members)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        binds,
      )
      const channel = await this.findById(params.channelId)
      if (channel === null) {
        throw new Error(`Failed to retrieve radio channel after insert: ${params.channelId}`)
      }
      return channel
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'ER_DUP_ENTRY') {
        throw new RadioChannelAlreadyExistsError(params.channelId)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async updateStatus(channelId: string, status: AtcChannelStatus): Promise<AtcRadioChannel> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<RadioChannelRow[]>(
        `SELECT id, channel_id, channel_name, channel_type, frequency, status,
                owner_principal_id, is_encrypted, max_members, created_at, updated_at
         FROM atc_radio_channels
         WHERE channel_id = ?
         FOR UPDATE`,
        [channelId],
      )
      const existing = rows[0]
      if (existing === undefined) {
        throw new RadioChannelNotFoundError(channelId)
      }
      await conn.query(
        `UPDATE atc_radio_channels SET status = ?, updated_at = NOW(3) WHERE channel_id = ?`,
        [status, channelId],
      )
      await conn.commit()
      committed = true
      const [updated] = await conn.query<RadioChannelRow[]>(
        `SELECT id, channel_id, channel_name, channel_type, frequency, status,
                owner_principal_id, is_encrypted, max_members, created_at, updated_at
         FROM atc_radio_channels WHERE channel_id = ? LIMIT 1`,
        [channelId],
      )
      const updatedRow = updated[0]
      if (updatedRow === undefined) throw new RadioChannelNotFoundError(channelId)
      return mapRow(updatedRow)
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async delete(channelId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.query(
        `DELETE FROM atc_radio_channels WHERE channel_id = ?`,
        [channelId],
      )
    } finally {
      conn.release()
    }
  }
}
