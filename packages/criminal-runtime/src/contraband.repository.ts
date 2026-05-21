import type { RowDataPacket } from 'mysql2/promise'
import type { AtcContraband, AtcContrabandStatus } from '@atc/shared-types'
import type { CriminalPool } from './pool.js'
import { generateId } from './id.js'
import { ContrabandNotFoundError, ContrabandAlreadySeizedError } from './errors.js'

interface ContrabandRow extends RowDataPacket {
  id: string
  property_id: string | null
  stash_id: string | null
  item_name: string
  quantity: number
  status: string
  registered_by_principal_id: string
  seized_by_principal_id: string | null
  seized_at: Date | null
  registered_at: Date
}

function rowToContraband(row: ContrabandRow): AtcContraband {
  return {
    id: row.id,
    propertyId: row.property_id,
    stashId: row.stash_id,
    itemName: row.item_name,
    quantity: row.quantity,
    status: row.status as AtcContrabandStatus,
    registeredByPrincipalId: row.registered_by_principal_id,
    seizedByPrincipalId: row.seized_by_principal_id,
    seizedAt: row.seized_at,
    registeredAt: row.registered_at,
  }
}

export interface RegisterContrabandParams {
  propertyId?: string | null | undefined
  stashId?: string | null | undefined
  itemName: string
  quantity: number
  registeredByPrincipalId: string
}

export class ContrabandRepository {
  constructor(private readonly pool: CriminalPool) {}

  async register(params: RegisterContrabandParams): Promise<AtcContraband> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_contraband
           (id, property_id, stash_id, item_name, quantity, status, registered_by_principal_id, registered_at)
         VALUES (?, ?, ?, ?, ?, 'registered', ?, NOW(3))`,
        [
          id,
          params.propertyId ?? null,
          params.stashId ?? null,
          params.itemName,
          params.quantity,
          params.registeredByPrincipalId,
        ],
      )
      const item = await this._findById(conn, id)
      if (!item) throw new ContrabandNotFoundError(id)
      return item
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<CriminalPool['getConnection']>>,
  ): Promise<AtcContraband | null> {
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

  async seize(id: string, seizedByPrincipalId: string): Promise<AtcContraband> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ContrabandRow[]>(
          `SELECT * FROM atc_contraband WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new ContrabandNotFoundError(id)
        if (rows[0].status === 'seized') throw new ContrabandAlreadySeizedError(id)

        await conn.execute(
          `UPDATE atc_contraband
           SET status = 'seized', seized_by_principal_id = ?, seized_at = NOW(3)
           WHERE id = ?`,
          [seizedByPrincipalId, id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, id)
      if (!updated) throw new ContrabandNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async destroy(id: string): Promise<AtcContraband> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<ContrabandRow[]>(
          `SELECT id FROM atc_contraband WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        if (!rows[0]) throw new ContrabandNotFoundError(id)

        await conn.execute(
          `UPDATE atc_contraband SET status = 'destroyed' WHERE id = ?`,
          [id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
      const updated = await this._findById(conn, id)
      if (!updated) throw new ContrabandNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async listByProperty(propertyId: string): Promise<AtcContraband[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ContrabandRow[]>(
        `SELECT * FROM atc_contraband WHERE property_id = ? ORDER BY registered_at DESC`,
        [propertyId],
      )
      return rows.map(rowToContraband)
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcContrabandStatus): Promise<AtcContraband[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ContrabandRow[]>(
        `SELECT * FROM atc_contraband WHERE status = ? ORDER BY registered_at DESC`,
        [status],
      )
      return rows.map(rowToContraband)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CriminalPool['getConnection']>>,
    id: string,
  ): Promise<AtcContraband | null> {
    const [rows] = await conn.execute<ContrabandRow[]>(
      `SELECT * FROM atc_contraband WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToContraband(rows[0]) : null
  }
}
