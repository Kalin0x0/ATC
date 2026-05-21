import type { RowDataPacket } from 'mysql2/promise'
import type { AtcGangMember, AtcGangMemberRank } from '@atc/shared-types'
import type { CriminalPool } from './pool.js'
import { generateId } from './id.js'
import { GangMemberNotFoundError, GangMemberAlreadyActiveError } from './errors.js'

interface GangMemberRow extends RowDataPacket {
  id: string
  gang_id: string
  principal_id: string
  rank: string
  invited_by_principal_id: string | null
  joined_at: Date
  left_at: Date | null
}

function rowToMember(row: GangMemberRow): AtcGangMember {
  return {
    id: row.id,
    gangId: row.gang_id,
    principalId: row.principal_id,
    rank: row.rank as AtcGangMemberRank,
    invitedByPrincipalId: row.invited_by_principal_id,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
  }
}

export interface AddMemberParams {
  gangId: string
  principalId: string
  rank: AtcGangMemberRank
  invitedByPrincipalId?: string | undefined
}

export class GangMemberRepository {
  constructor(private readonly pool: CriminalPool) {}

  async add(
    params: AddMemberParams,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<AtcGangMember> {
    const id = generateId()
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      // Check for existing active membership with a lock
      const [existing] = await connection.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members
         WHERE gang_id = ? AND principal_id = ? AND left_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [params.gangId, params.principalId],
      )
      if (existing[0]) {
        throw new GangMemberAlreadyActiveError(params.gangId, params.principalId)
      }

      await connection.execute(
        `INSERT INTO atc_gang_members
           (id, gang_id, principal_id, rank, invited_by_principal_id, joined_at)
         VALUES (?, ?, ?, ?, ?, NOW(3))`,
        [
          id,
          params.gangId,
          params.principalId,
          params.rank,
          params.invitedByPrincipalId ?? null,
        ],
      )

      const [rows] = await connection.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new GangMemberNotFoundError(params.gangId, params.principalId)
      return rowToMember(rows[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async remove(
    gangId: string,
    principalId: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<AtcGangMember> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      const [rows] = await connection.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members
         WHERE gang_id = ? AND principal_id = ? AND left_at IS NULL
         LIMIT 1 FOR UPDATE`,
        [gangId, principalId],
      )
      if (!rows[0]) throw new GangMemberNotFoundError(gangId, principalId)

      await connection.execute(
        `UPDATE atc_gang_members SET left_at = NOW(3) WHERE id = ?`,
        [rows[0].id],
      )

      const [updated] = await connection.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members WHERE id = ? LIMIT 1`,
        [rows[0].id],
      )
      if (!updated[0]) throw new GangMemberNotFoundError(gangId, principalId)
      return rowToMember(updated[0])
    } finally {
      if (owned) connection.release()
    }
  }

  async findActive(gangId: string, principalId: string): Promise<AtcGangMember | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members
         WHERE gang_id = ? AND principal_id = ? AND left_at IS NULL
         LIMIT 1`,
        [gangId, principalId],
      )
      return rows[0] ? rowToMember(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActiveByGang(gangId: string): Promise<AtcGangMember[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members
         WHERE gang_id = ? AND left_at IS NULL
         ORDER BY joined_at ASC`,
        [gangId],
      )
      return rows.map(rowToMember)
    } finally {
      conn.release()
    }
  }

  async listActiveByPrincipal(principalId: string): Promise<AtcGangMember[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GangMemberRow[]>(
        `SELECT * FROM atc_gang_members
         WHERE principal_id = ? AND left_at IS NULL
         ORDER BY joined_at ASC`,
        [principalId],
      )
      return rows.map(rowToMember)
    } finally {
      conn.release()
    }
  }
}
