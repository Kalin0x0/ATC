import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { FactionPool } from './pool.js'
import { generateId } from './id.js'
import { FactionAlreadyExistsError, FactionNotFoundError } from './errors.js'

export type AtcFactionType = 'gang' | 'police' | 'military' | 'government' | 'civilian' | 'other'
export type AtcFactionStatus = 'active' | 'disbanded' | 'suspended'

export interface AtcFaction {
  id: string
  name: string
  tag: string
  leaderPrincipalId: string
  factionType: AtcFactionType
  status: AtcFactionStatus
  memberCount: number
  colorHex: string | null
  description: string | null
  territoryCount: number
  createdAt: Date
  updatedAt: Date
}

interface FactionRow extends RowDataPacket {
  id: string
  name: string
  tag: string
  leader_principal_id: string
  faction_type: string
  status: string
  member_count: number
  color_hex: string | null
  description: string | null
  territory_count: number
  created_at: Date
  updated_at: Date
}

function rowToFaction(row: FactionRow): AtcFaction {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    leaderPrincipalId: row.leader_principal_id,
    factionType: row.faction_type as AtcFactionType,
    status: row.status as AtcFactionStatus,
    memberCount: row.member_count,
    colorHex: row.color_hex,
    description: row.description,
    territoryCount: row.territory_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateFactionParams {
  name: string
  tag: string
  leaderPrincipalId: string
  factionType?: AtcFactionType
  colorHex?: string | null | undefined
  description?: string | null | undefined
}

export class FactionRepository {
  constructor(private readonly pool: FactionPool) {}

  async create(params: CreateFactionParams): Promise<AtcFaction> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const factionType = params.factionType ?? 'gang'
      const colorHex = params.colorHex ?? null
      const description = params.description ?? null
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_factions
             (id, name, tag, leader_principal_id, faction_type, status, member_count, color_hex, description, territory_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, 0, NOW(3), NOW(3))`,
          [id, params.name, params.tag, params.leaderPrincipalId, factionType, colorHex, description],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new FactionAlreadyExistsError(params.tag)
        }
        throw err
      }
      const [rows] = await conn.execute<FactionRow[]>(
        'SELECT * FROM atc_factions WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToFaction(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcFaction | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FactionRow[]>(
        'SELECT * FROM atc_factions WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToFaction(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByTag(tag: string): Promise<AtcFaction | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FactionRow[]>(
        'SELECT * FROM atc_factions WHERE tag = ? LIMIT 1',
        [tag],
      )
      return rows[0] ? rowToFaction(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcFaction[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<FactionRow[]>(
        "SELECT * FROM atc_factions WHERE status = 'active' ORDER BY name ASC",
      )
      return rows.map(rowToFaction)
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcFactionStatus): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        'UPDATE atc_factions SET status = ?, updated_at = NOW(3) WHERE id = ?',
        [status, id],
      )
      if (result.affectedRows === 0) throw new FactionNotFoundError(id)
    } finally {
      conn.release()
    }
  }

  async incrementMemberCount(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_factions SET member_count = member_count + 1, updated_at = NOW(3) WHERE id = ?',
        [id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async decrementMemberCount(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_factions SET member_count = GREATEST(0, member_count - 1), updated_at = NOW(3) WHERE id = ?',
        [id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async incrementTerritoryCount(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_factions SET territory_count = territory_count + 1, updated_at = NOW(3) WHERE id = ?',
        [id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async decrementTerritoryCount(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_factions SET territory_count = GREATEST(0, territory_count - 1), updated_at = NOW(3) WHERE id = ?',
        [id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }
}
