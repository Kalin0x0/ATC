import type { RowDataPacket } from 'mysql2'
import type { CommunicationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { MembershipAlreadyExistsError, MembershipNotFoundError } from './errors.js'

export type AtcMembershipRole = 'listener' | 'speaker' | 'moderator' | 'admin'

export interface AtcRadioMembership {
  id: string
  channelId: string
  principalId: string
  role: AtcMembershipRole
  joinedAt: Date
  updatedAt: Date
}

interface RadioMembershipRow extends RowDataPacket {
  id: string
  channel_id: string
  principal_id: string
  role: string
  joined_at: Date
  updated_at: Date
}

function mapRow(row: RadioMembershipRow): AtcRadioMembership {
  return {
    id: row.id,
    channelId: row.channel_id,
    principalId: row.principal_id,
    role: row.role as AtcMembershipRole,
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  }
}

export class RadioMembershipRepository {
  constructor(private readonly pool: CommunicationRuntimePool) {}

  async findByChannelAndPrincipal(
    channelId: string,
    principalId: string,
  ): Promise<AtcRadioMembership | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<RadioMembershipRow[]>(
        `SELECT id, channel_id, principal_id, role, joined_at, updated_at
         FROM atc_radio_memberships
         WHERE channel_id = ? AND principal_id = ?`,
        [channelId, principalId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listByChannel(channelId: string): Promise<AtcRadioMembership[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<RadioMembershipRow[]>(
        `SELECT id, channel_id, principal_id, role, joined_at, updated_at
         FROM atc_radio_memberships
         WHERE channel_id = ?
         ORDER BY joined_at ASC`,
        [channelId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listByPrincipal(principalId: string): Promise<AtcRadioMembership[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<RadioMembershipRow[]>(
        `SELECT id, channel_id, principal_id, role, joined_at, updated_at
         FROM atc_radio_memberships
         WHERE principal_id = ?
         ORDER BY joined_at ASC`,
        [principalId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async addMember(
    channelId: string,
    principalId: string,
    role: AtcMembershipRole,
  ): Promise<AtcRadioMembership> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.query(
        `INSERT INTO atc_radio_memberships
           (id, channel_id, principal_id, role)
         VALUES (?, ?, ?, ?)`,
        [id, channelId, principalId, role],
      )
      const membership = await this.findByChannelAndPrincipal(channelId, principalId)
      if (membership === null) {
        throw new Error(
          `Failed to retrieve membership after insert: ${channelId}/${principalId}`,
        )
      }
      return membership
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e.code === 'ER_DUP_ENTRY') {
        throw new MembershipAlreadyExistsError(channelId, principalId)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async updateRole(
    channelId: string,
    principalId: string,
    role: AtcMembershipRole,
  ): Promise<AtcRadioMembership> {
    const conn = await this.pool.getConnection()
    try {
      const existing = await this.findByChannelAndPrincipal(channelId, principalId)
      if (existing === null) {
        throw new MembershipNotFoundError(channelId, principalId)
      }
      await conn.query(
        `UPDATE atc_radio_memberships
         SET role = ?, updated_at = NOW(3)
         WHERE channel_id = ? AND principal_id = ?`,
        [role, channelId, principalId],
      )
      return { ...existing, role }
    } finally {
      conn.release()
    }
  }

  async removeMember(channelId: string, principalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.query(
        `DELETE FROM atc_radio_memberships
         WHERE channel_id = ? AND principal_id = ?`,
        [channelId, principalId],
      )
    } finally {
      conn.release()
    }
  }
}
