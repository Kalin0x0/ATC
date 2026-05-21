import type { RowDataPacket } from 'mysql2/promise'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import {
  UtilityGridNotFoundError,
  UtilityGridAlreadyDownError,
  UtilityGridAlreadyRestoredError,
  DuplicateOutageError,
} from './errors.js'

export type AtcUtilityType = 'power' | 'water' | 'gas' | 'telecom' | 'sewage'
export type AtcGridStatus = 'online' | 'degraded' | 'offline' | 'maintenance'

export interface AtcUtilityGrid {
  id: string
  gridId: string
  gridName: string
  utilityType: AtcUtilityType
  status: AtcGridStatus
  affectedZones: string[]
  outageNonce: string | null
  outageStartedAt: Date | null
  restoredAt: Date | null
  restoredByPrincipalId: string | null
  outageReason: string | null
  createdAt: Date
  updatedAt: Date
}

interface GridRow extends RowDataPacket {
  id: string
  grid_id: string
  grid_name: string
  utility_type: string
  status: string
  affected_zones: string
  outage_nonce: string | null
  outage_started_at: Date | null
  restored_at: Date | null
  restored_by_principal_id: string | null
  outage_reason: string | null
  created_at: Date
  updated_at: Date
}

function rowToGrid(row: GridRow): AtcUtilityGrid {
  let affectedZones: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.affected_zones)
    if (Array.isArray(parsed)) {
      affectedZones = parsed as string[]
    }
  } catch {
    affectedZones = []
  }
  return {
    id: row.id,
    gridId: row.grid_id,
    gridName: row.grid_name,
    utilityType: row.utility_type as AtcUtilityType,
    status: row.status as AtcGridStatus,
    affectedZones,
    outageNonce: row.outage_nonce,
    outageStartedAt: row.outage_started_at,
    restoredAt: row.restored_at,
    restoredByPrincipalId: row.restored_by_principal_id,
    outageReason: row.outage_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface TransitionGridOptions {
  outageNonce?: string | undefined
  outageReason?: string | undefined
  affectedZones?: string[] | undefined
  restoredByPrincipalId?: string | undefined
}

export class UtilityGridRepository {
  constructor(private readonly pool: CityRuntimePool) {}

  async findByGridId(gridId: string): Promise<AtcUtilityGrid | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GridRow[]>(
        `SELECT * FROM atc_utility_grids WHERE grid_id = ? LIMIT 1`,
        [gridId],
      )
      return rows[0] ? rowToGrid(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByOutageNonce(nonce: string): Promise<AtcUtilityGrid | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GridRow[]>(
        `SELECT * FROM atc_utility_grids WHERE outage_nonce = ? LIMIT 1`,
        [nonce],
      )
      return rows[0] ? rowToGrid(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async transition(
    gridId: string,
    status: AtcGridStatus,
    opts: TransitionGridOptions = {},
  ): Promise<AtcUtilityGrid> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<GridRow[]>(
          `SELECT * FROM atc_utility_grids WHERE grid_id = ? LIMIT 1 FOR UPDATE`,
          [gridId],
        )
        if (!rows[0]) throw new UtilityGridNotFoundError(gridId)

        const current = rowToGrid(rows[0])

        if (status === 'offline' && current.status === 'offline') {
          throw new UtilityGridAlreadyDownError(gridId)
        }
        if (status === 'online' && current.status === 'online') {
          throw new UtilityGridAlreadyRestoredError(gridId)
        }

        // Nonce uniqueness check
        if (opts.outageNonce !== undefined) {
          const [nonceCheck] = await conn.execute<GridRow[]>(
            `SELECT id FROM atc_utility_grids
             WHERE outage_nonce = ? AND grid_id != ?
             LIMIT 1`,
            [opts.outageNonce, gridId],
          )
          if (nonceCheck.length > 0) {
            throw new DuplicateOutageError(opts.outageNonce)
          }
        }

        const isRestoring = status === 'online'
        const isOutage = status === 'offline' || status === 'degraded'

        // Build SET clause dynamically to stay clean with exactOptionalPropertyTypes
        const setClauses: string[] = ['status = ?', 'updated_at = NOW(3)']
        const binds: (string | number | boolean | null)[] = [status]

        if (opts.affectedZones !== undefined) {
          setClauses.push('affected_zones = ?')
          binds.push(JSON.stringify(opts.affectedZones))
        }

        if (isRestoring) {
          setClauses.push('outage_nonce = NULL')
          setClauses.push('restored_at = NOW(3)')
          if (opts.restoredByPrincipalId !== undefined) {
            setClauses.push('restored_by_principal_id = ?')
            binds.push(opts.restoredByPrincipalId)
          }
        } else {
          if (opts.outageNonce !== undefined) {
            setClauses.push('outage_nonce = ?')
            binds.push(opts.outageNonce)
          }
          if (opts.outageReason !== undefined) {
            setClauses.push('outage_reason = ?')
            binds.push(opts.outageReason)
          }
          if (isOutage) {
            setClauses.push('outage_started_at = COALESCE(outage_started_at, NOW(3))')
          }
          setClauses.push('restored_at = NULL')
          setClauses.push('restored_by_principal_id = NULL')
        }

        binds.push(gridId)
        await conn.execute(
          `UPDATE atc_utility_grids SET ${setClauses.join(', ')} WHERE grid_id = ?`,
          binds,
        )

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<GridRow[]>(
        `SELECT * FROM atc_utility_grids WHERE grid_id = ? LIMIT 1`,
        [gridId],
      )
      if (!rows[0]) throw new UtilityGridNotFoundError(gridId)
      return rowToGrid(rows[0])
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcGridStatus): Promise<AtcUtilityGrid[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GridRow[]>(
        `SELECT * FROM atc_utility_grids WHERE status = ? ORDER BY grid_name ASC`,
        [status],
      )
      return rows.map(rowToGrid)
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcUtilityGrid[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GridRow[]>(
        `SELECT * FROM atc_utility_grids ORDER BY grid_name ASC`,
      )
      return rows.map(rowToGrid)
    } finally {
      conn.release()
    }
  }
}
