import type { RowDataPacket } from 'mysql2/promise'
import type { AtcGang, AtcGangStatus } from '@atc/shared-types'
import type { CriminalPool } from './pool.js'
import { generateId } from './id.js'
import { GangNotFoundError, GangAlreadyExistsError } from './errors.js'

interface GangRow extends RowDataPacket {
  id: string
  name: string
  tag: string
  leader_principal_id: string
  territory_id: string | null
  status: string
  member_count: number
  created_at: Date
  updated_at: Date
}

function rowToGang(row: GangRow): AtcGang {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    leaderPrincipalId: row.leader_principal_id,
    territoryId: row.territory_id,
    status: row.status as AtcGangStatus,
    memberCount: row.member_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateGangParams {
  name: string
  tag: string
  leaderPrincipalId: string
  territoryId?: string | null | undefined
}

export class GangRepository {
  constructor(private readonly pool: CriminalPool) {}

  async create(params: CreateGangParams): Promise<AtcGang> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_gangs
             (id, name, tag, leader_principal_id, territory_id, status, member_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', 0, NOW(3), NOW(3))`,
          [id, params.name, params.tag, params.leaderPrincipalId, params.territoryId ?? null],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new GangAlreadyExistsError(params.tag)
        }
        throw err
      }
      const gang = await this._findById(conn, id)
      if (!gang) throw new GangNotFoundError(id)
      return gang
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<AtcGang | null> {
    if (conn) {
      return this._findById(conn, id)
    }
    const c = await this.pool.getConnection()
    try {
      return this._findById(c, id)
    } finally {
      c.release()
    }
  }

  async findByTag(tag: string): Promise<AtcGang | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GangRow[]>(
        `SELECT * FROM atc_gangs WHERE tag = ? LIMIT 1`,
        [tag],
      )
      return rows[0] ? rowToGang(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcGang[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GangRow[]>(
        `SELECT * FROM atc_gangs WHERE status = 'active' ORDER BY name ASC`,
      )
      return rows.map(rowToGang)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcGangStatus): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<GangRow[]>(
          `SELECT id FROM atc_gangs WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new GangNotFoundError(id)
        await conn.execute(
          `UPDATE atc_gangs SET status = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async incrementMemberCount(
    id: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_gangs SET member_count = member_count + 1, updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
    } finally {
      if (owned) connection.release()
    }
  }

  async decrementMemberCount(
    id: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<void> {
    const connection = conn ?? await this.pool.getConnection()
    const owned = !conn
    try {
      await connection.execute(
        `UPDATE atc_gangs SET member_count = GREATEST(0, member_count - 1), updated_at = NOW(3) WHERE id = ?`,
        [id],
      )
    } finally {
      if (owned) connection.release()
    }
  }

  async listByLeader(leaderId: string): Promise<AtcGang[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GangRow[]>(
        `SELECT * FROM atc_gangs WHERE leader_principal_id = ? ORDER BY created_at DESC`,
        [leaderId],
      )
      return rows.map(rowToGang)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CriminalPool['getConnection']>>,
    id: string,
  ): Promise<AtcGang | null> {
    const [rows] = await conn.execute<GangRow[]>(
      `SELECT * FROM atc_gangs WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToGang(rows[0]) : null
  }
}
