import type { RowDataPacket } from 'mysql2/promise'
import type {
  AtcWeaponRegistration,
  AtcWeaponStatus,
  AtcWeaponCategory,
} from '@atc/shared-types'
import type { CombatPool } from './pool.js'
import { generateId } from './id.js'
import { WeaponNotFoundError, WeaponValidationError } from './errors.js'

interface WeaponRow extends RowDataPacket {
  id: string
  owner_id: string | null
  organization_id: string | null
  model: string
  category: string
  serial: string
  durability: number
  is_locked: number
  status: string
  registered_by_principal_id: string | null
  seized_by_principal_id: string | null
  seized_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToWeapon(row: WeaponRow): AtcWeaponRegistration {
  return {
    id: row.id,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    model: row.model,
    category: row.category as AtcWeaponCategory,
    serial: row.serial,
    durability: row.durability,
    isLocked: row.is_locked === 1,
    status: row.status as AtcWeaponStatus,
    registeredByPrincipalId: row.registered_by_principal_id,
    seizedByPrincipalId: row.seized_by_principal_id,
    seizedAt: row.seized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ALLOWED_TRANSITIONS: Record<AtcWeaponStatus, AtcWeaponStatus[]> = {
  registered: ['active', 'lost', 'seized', 'destroyed'],
  active:     ['lost', 'seized', 'destroyed'],
  lost:       ['registered', 'seized'],
  seized:     ['destroyed'],
  destroyed:  [],
}

export interface CreateWeaponParams {
  ownerId?: string | null | undefined
  organizationId?: string | null | undefined
  model: string
  category: AtcWeaponCategory
  serial: string
  registeredByPrincipalId?: string | null | undefined
}

export class WeaponRepository {
  constructor(private readonly pool: CombatPool) {}

  async create(params: CreateWeaponParams): Promise<AtcWeaponRegistration> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_weapon_registry
           (id, owner_id, organization_id, model, category, serial,
            durability, is_locked, status, registered_by_principal_id,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 100, 0, 'registered', ?, NOW(3), NOW(3))`,
        [
          id,
          params.ownerId ?? null,
          params.organizationId ?? null,
          params.model,
          params.category,
          params.serial,
          params.registeredByPrincipalId ?? null,
        ],
      )
      const weapon = await this._findById(conn, id)
      if (!weapon) throw new WeaponNotFoundError(id)
      return weapon
    } finally {
      conn.release()
    }
  }

  async findById(
    id: string,
    conn?: Awaited<ReturnType<CombatPool['getConnection']>>,
  ): Promise<AtcWeaponRegistration | null> {
    if (conn) {
      return this._findById(conn, id)
    }
    const connection = await this.pool.getConnection()
    try {
      return this._findById(connection, id)
    } finally {
      connection.release()
    }
  }

  async findBySerial(serial: string): Promise<AtcWeaponRegistration | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WeaponRow[]>(
        `SELECT * FROM atc_weapon_registry WHERE serial = ? LIMIT 1`,
        [serial],
      )
      return rows[0] ? rowToWeapon(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByOwner(ownerId: string): Promise<AtcWeaponRegistration[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WeaponRow[]>(
        `SELECT * FROM atc_weapon_registry WHERE owner_id = ? ORDER BY created_at DESC`,
        [ownerId],
      )
      return rows.map(rowToWeapon)
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcWeaponStatus,
    opts?: { seizedByPrincipalId?: string | undefined } | undefined,
  ): Promise<AtcWeaponRegistration> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<WeaponRow[]>(
          `SELECT * FROM atc_weapon_registry WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id],
        )
        const current = rows[0] ? rowToWeapon(rows[0]) : null
        if (!current) throw new WeaponNotFoundError(id)

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(status)) {
          throw new WeaponValidationError(
            `Cannot transition weapon ${id} from '${current.status}' to '${status}'`,
          )
        }

        const seizedBy = opts?.seizedByPrincipalId ?? null
        const seizedAt = status === 'seized' ? 'NOW(3)' : 'NULL'

        if (status === 'seized' && seizedBy !== null) {
          await conn.execute(
            `UPDATE atc_weapon_registry
             SET status = ?,
                 seized_by_principal_id = ?,
                 seized_at = NOW(3),
                 updated_at = NOW(3)
             WHERE id = ?`,
            [status, seizedBy, id],
          )
        } else if (status === 'seized') {
          await conn.execute(
            `UPDATE atc_weapon_registry
             SET status = ?,
                 seized_at = NOW(3),
                 updated_at = NOW(3)
             WHERE id = ?`,
            [status, id],
          )
        } else {
          void seizedAt
          await conn.execute(
            `UPDATE atc_weapon_registry
             SET status = ?,
                 updated_at = NOW(3)
             WHERE id = ?`,
            [status, id],
          )
        }

        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const updated = await this._findById(conn, id)
      if (!updated) throw new WeaponNotFoundError(id)
      return updated
    } finally {
      conn.release()
    }
  }

  async updateDurability(id: string, durability: number): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_weapon_registry SET durability = ?, updated_at = NOW(3) WHERE id = ?`,
        [durability, id],
      )
    } finally {
      conn.release()
    }
  }

  async setLocked(id: string, isLocked: boolean): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_weapon_registry SET is_locked = ?, updated_at = NOW(3) WHERE id = ?`,
        [isLocked ? 1 : 0, id],
      )
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<CombatPool['getConnection']>>,
    id: string,
  ): Promise<AtcWeaponRegistration | null> {
    const [rows] = await conn.execute<WeaponRow[]>(
      `SELECT * FROM atc_weapon_registry WHERE id = ? LIMIT 1`,
      [id],
    )
    return rows[0] ? rowToWeapon(rows[0]) : null
  }
}
