import type { RowDataPacket } from 'mysql2/promise'
import type { AtcWeaponRuntime } from '@atc/shared-types'
import type { CombatPool } from './pool.js'
import { generateId } from './id.js'
import { WeaponAlreadyEquippedError } from './errors.js'

interface WeaponRuntimeRow extends RowDataPacket {
  id: string
  weapon_id: string
  holder_principal_id: string
  is_equipped: number
  current_ammo: number
  max_ammo: number
  attachment_state: string | null
  equipped_at: Date | null
  unequipped_at: Date | null
  last_sync_at: Date
}

function rowToRuntime(row: WeaponRuntimeRow): AtcWeaponRuntime {
  let attachmentState: Record<string, string> | null = null
  if (row.attachment_state !== null) {
    try {
      attachmentState = JSON.parse(row.attachment_state) as Record<string, string>
    } catch {
      attachmentState = null
    }
  }
  return {
    id: row.id,
    weaponId: row.weapon_id,
    holderPrincipalId: row.holder_principal_id,
    isEquipped: row.is_equipped === 1,
    currentAmmo: row.current_ammo,
    maxAmmo: row.max_ammo,
    attachmentState,
    equippedAt: row.equipped_at,
    unequippedAt: row.unequipped_at,
    lastSyncAt: row.last_sync_at,
  }
}

export interface UpsertRuntimeParams {
  weaponId: string
  holderPrincipalId: string
  isEquipped: boolean
  currentAmmo: number
  maxAmmo: number
  attachmentState?: Record<string, string> | undefined
}

export class WeaponRuntimeRepository {
  constructor(private readonly pool: CombatPool) {}

  async upsertRuntime(params: UpsertRuntimeParams): Promise<AtcWeaponRuntime> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      const attachmentJson = params.attachmentState
        ? JSON.stringify(params.attachmentState)
        : null
      await conn.execute(
        `INSERT INTO atc_weapon_runtime
           (id, weapon_id, holder_principal_id, is_equipped, current_ammo, max_ammo,
            attachment_state, last_sync_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE
           is_equipped      = VALUES(is_equipped),
           current_ammo     = VALUES(current_ammo),
           max_ammo         = VALUES(max_ammo),
           attachment_state = COALESCE(VALUES(attachment_state), attachment_state),
           last_sync_at     = NOW(3)`,
        [
          id,
          params.weaponId,
          params.holderPrincipalId,
          params.isEquipped ? 1 : 0,
          params.currentAmmo,
          params.maxAmmo,
          attachmentJson,
        ],
      )
      const runtime = await this._findByWeaponAndHolder(conn, params.weaponId, params.holderPrincipalId)
      if (!runtime) {
        // Fallback: select newly inserted or updated row
        const [rows] = await conn.execute<WeaponRuntimeRow[]>(
          `SELECT * FROM atc_weapon_runtime WHERE weapon_id = ? AND holder_principal_id = ? LIMIT 1`,
          [params.weaponId, params.holderPrincipalId],
        )
        return rowToRuntime(rows[0]!)
      }
      return runtime
    } finally {
      conn.release()
    }
  }

  async equip(weaponId: string, holderPrincipalId: string): Promise<AtcWeaponRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<WeaponRuntimeRow[]>(
          `SELECT * FROM atc_weapon_runtime
           WHERE weapon_id = ? AND holder_principal_id = ?
           LIMIT 1 FOR UPDATE`,
          [weaponId, holderPrincipalId],
        )
        const current = rows[0] ? rowToRuntime(rows[0]) : null
        if (current?.isEquipped) {
          throw new WeaponAlreadyEquippedError(weaponId)
        }

        await conn.execute(
          `UPDATE atc_weapon_runtime
           SET is_equipped = 1, equipped_at = NOW(3), unequipped_at = NULL, last_sync_at = NOW(3)
           WHERE weapon_id = ? AND holder_principal_id = ?`,
          [weaponId, holderPrincipalId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const updated = await this._findByWeaponAndHolder(conn, weaponId, holderPrincipalId)
      if (!updated) throw new WeaponAlreadyEquippedError(weaponId)
      return updated
    } finally {
      conn.release()
    }
  }

  async unequip(weaponId: string, holderPrincipalId: string): Promise<AtcWeaponRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<WeaponRuntimeRow[]>(
          `SELECT * FROM atc_weapon_runtime
           WHERE weapon_id = ? AND holder_principal_id = ?
           LIMIT 1 FOR UPDATE`,
          [weaponId, holderPrincipalId],
        )
        if (!rows[0]) {
          throw new WeaponAlreadyEquippedError(weaponId)
        }

        await conn.execute(
          `UPDATE atc_weapon_runtime
           SET is_equipped = 0, unequipped_at = NOW(3), last_sync_at = NOW(3)
           WHERE weapon_id = ? AND holder_principal_id = ?`,
          [weaponId, holderPrincipalId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const updated = await this._findByWeaponAndHolder(conn, weaponId, holderPrincipalId)
      if (!updated) throw new WeaponAlreadyEquippedError(weaponId)
      return updated
    } finally {
      conn.release()
    }
  }

  async findByWeaponAndHolder(
    weaponId: string,
    holderPrincipalId: string,
  ): Promise<AtcWeaponRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findByWeaponAndHolder(conn, weaponId, holderPrincipalId)
    } finally {
      conn.release()
    }
  }

  async findEquippedByHolder(holderPrincipalId: string): Promise<AtcWeaponRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<WeaponRuntimeRow[]>(
        `SELECT * FROM atc_weapon_runtime
         WHERE holder_principal_id = ? AND is_equipped = 1
         ORDER BY equipped_at DESC`,
        [holderPrincipalId],
      )
      return rows.map(rowToRuntime)
    } finally {
      conn.release()
    }
  }

  async updateAmmo(
    weaponId: string,
    holderPrincipalId: string,
    currentAmmo: number,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_weapon_runtime
         SET current_ammo = ?, last_sync_at = NOW(3)
         WHERE weapon_id = ? AND holder_principal_id = ?`,
        [currentAmmo, weaponId, holderPrincipalId],
      )
    } finally {
      conn.release()
    }
  }

  async updateLastSync(weaponId: string, holderPrincipalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_weapon_runtime
         SET last_sync_at = NOW(3)
         WHERE weapon_id = ? AND holder_principal_id = ?`,
        [weaponId, holderPrincipalId],
      )
    } finally {
      conn.release()
    }
  }

  private async _findByWeaponAndHolder(
    conn: Awaited<ReturnType<CombatPool['getConnection']>>,
    weaponId: string,
    holderPrincipalId: string,
  ): Promise<AtcWeaponRuntime | null> {
    const [rows] = await conn.execute<WeaponRuntimeRow[]>(
      `SELECT * FROM atc_weapon_runtime
       WHERE weapon_id = ? AND holder_principal_id = ? LIMIT 1`,
      [weaponId, holderPrincipalId],
    )
    return rows[0] ? rowToRuntime(rows[0]) : null
  }
}
