import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { FactionPool } from './pool.js'
import { generateId } from './id.js'
import { TerritoryNotFoundError } from './errors.js'

export type AtcTerritoryType = 'district' | 'zone' | 'building' | 'intersection' | 'highway' | 'port' | 'airport' | 'other'

export interface AtcTerritory {
  id: string
  territoryId: string
  label: string
  territoryType: AtcTerritoryType
  controllingFactionId: string | null
  influenceLevel: number
  isContested: boolean
  centerX: number | null
  centerY: number | null
  centerZ: number | null
  radius: number | null
  taxRate: number
  lastCaptureAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface TerritoryRow extends RowDataPacket {
  id: string
  territory_id: string
  label: string
  territory_type: string
  controlling_faction_id: string | null
  influence_level: number
  is_contested: number
  center_x: string | null
  center_y: string | null
  center_z: string | null
  radius: string | null
  tax_rate: string
  last_capture_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToTerritory(row: TerritoryRow): AtcTerritory {
  return {
    id: row.id,
    territoryId: row.territory_id,
    label: row.label,
    territoryType: row.territory_type as AtcTerritoryType,
    controllingFactionId: row.controlling_faction_id,
    influenceLevel: row.influence_level,
    isContested: row.is_contested === 1,
    centerX: row.center_x !== null ? Number(row.center_x) : null,
    centerY: row.center_y !== null ? Number(row.center_y) : null,
    centerZ: row.center_z !== null ? Number(row.center_z) : null,
    radius: row.radius !== null ? Number(row.radius) : null,
    taxRate: Number(row.tax_rate),
    lastCaptureAt: row.last_capture_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateTerritoryParams {
  territoryId: string
  label: string
  territoryType: AtcTerritoryType
  centerX?: number | null | undefined
  centerY?: number | null | undefined
  centerZ?: number | null | undefined
  radius?: number | null | undefined
  taxRate?: number
}

export class TerritoryRepository {
  constructor(private readonly pool: FactionPool) {}

  async create(params: CreateTerritoryParams): Promise<AtcTerritory> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const centerX = params.centerX ?? null
      const centerY = params.centerY ?? null
      const centerZ = params.centerZ ?? null
      const radius = params.radius ?? null
      const taxRate = params.taxRate ?? 0.05
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_territories
             (id, territory_id, label, territory_type, controlling_faction_id, influence_level, is_contested, center_x, center_y, center_z, radius, tax_rate, last_capture_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, 0, 0, ?, ?, ?, ?, ?, NULL, NOW(3), NOW(3))`,
          [id, params.territoryId, params.label, params.territoryType, centerX, centerY, centerZ, radius, taxRate],
        )
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const existing = await this.findByTerritoryId(params.territoryId)
          if (existing) return existing
        }
        throw err
      }
      const [rows] = await conn.execute<TerritoryRow[]>(
        'SELECT * FROM atc_territories WHERE id = ? LIMIT 1',
        [id],
      )
      return rowToTerritory(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTerritory | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryRow[]>(
        'SELECT * FROM atc_territories WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToTerritory(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByTerritoryId(territoryId: string): Promise<AtcTerritory | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryRow[]>(
        'SELECT * FROM atc_territories WHERE territory_id = ? LIMIT 1',
        [territoryId],
      )
      return rows[0] ? rowToTerritory(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcTerritory[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryRow[]>(
        'SELECT * FROM atc_territories ORDER BY label ASC',
      )
      return rows.map(rowToTerritory)
    } finally {
      conn.release()
    }
  }

  async listByFaction(factionId: string): Promise<AtcTerritory[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryRow[]>(
        'SELECT * FROM atc_territories WHERE controlling_faction_id = ? ORDER BY label ASC',
        [factionId],
      )
      return rows.map(rowToTerritory)
    } finally {
      conn.release()
    }
  }

  async setController(id: string, factionId: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      if (ownConn) await c.beginTransaction()
      await c.execute(
        'SELECT id FROM atc_territories WHERE id = ? FOR UPDATE',
        [id],
      )
      const [result] = await c.execute<ResultSetHeader>(
        'UPDATE atc_territories SET controlling_faction_id = ?, last_capture_at = NOW(3), updated_at = NOW(3) WHERE id = ?',
        [factionId, id],
      )
      if (result.affectedRows === 0) {
        if (ownConn) await c.rollback()
        throw new TerritoryNotFoundError(id)
      }
      if (ownConn) await c.commit()
    } catch (err) {
      if (ownConn) { try { await c.rollback() } catch { /* ignore */ } }
      throw err
    } finally {
      if (ownConn) c.release()
    }
  }

  async clearController(id: string, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_territories SET controlling_faction_id = NULL, updated_at = NOW(3) WHERE id = ?',
        [id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async setContested(id: string, isContested: boolean, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      await c.execute(
        'UPDATE atc_territories SET is_contested = ?, updated_at = NOW(3) WHERE id = ?',
        [isContested ? 1 : 0, id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }

  async updateInfluence(id: string, influenceLevel: number, conn?: PoolConnection): Promise<void> {
    const ownConn = conn === undefined
    const c = ownConn ? await this.pool.getConnection() : conn
    try {
      const clamped = Math.max(0, Math.min(100, influenceLevel))
      await c.execute(
        'UPDATE atc_territories SET influence_level = ?, updated_at = NOW(3) WHERE id = ?',
        [clamped, id],
      )
    } finally {
      if (ownConn) c.release()
    }
  }
}
