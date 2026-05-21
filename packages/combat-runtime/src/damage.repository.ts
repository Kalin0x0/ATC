import type { RowDataPacket } from 'mysql2/promise'
import type { AtcDamageEvent, AtcCombatBodyRegion } from '@atc/shared-types'
import type { CombatPool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateDamageError } from './errors.js'

interface DamageEventRow extends RowDataPacket {
  id: string
  session_id: string | null
  attacker_principal_id: string
  victim_principal_id: string
  weapon_id: string | null
  weapon_model: string
  hit_bone: string
  damage_amount: number
  mitigated_amount: number
  net_damage: number
  hit_x: number | null
  hit_y: number | null
  hit_z: number | null
  replay_nonce: string
  created_at: Date
}

function rowToDamageEvent(row: DamageEventRow): AtcDamageEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    attackerPrincipalId: row.attacker_principal_id,
    victimPrincipalId: row.victim_principal_id,
    weaponId: row.weapon_id,
    weaponModel: row.weapon_model,
    hitBone: row.hit_bone as AtcCombatBodyRegion,
    damageAmount: row.damage_amount,
    mitigatedAmount: row.mitigated_amount,
    netDamage: row.net_damage,
    hitX: row.hit_x,
    hitY: row.hit_y,
    hitZ: row.hit_z,
    replayNonce: row.replay_nonce,
    createdAt: row.created_at,
  }
}

export interface RecordDamageParams {
  sessionId?: string | null | undefined
  attackerPrincipalId: string
  victimPrincipalId: string
  weaponId?: string | null | undefined
  weaponModel: string
  hitBone: AtcCombatBodyRegion
  damageAmount: number
  mitigatedAmount: number
  netDamage: number
  hitX?: number | null | undefined
  hitY?: number | null | undefined
  hitZ?: number | null | undefined
  replayNonce: string
}

export class DamageRepository {
  constructor(private readonly pool: CombatPool) {}

  async record(params: RecordDamageParams): Promise<AtcDamageEvent> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      try {
        await conn.execute(
          `INSERT INTO atc_damage_events
             (id, session_id, attacker_principal_id, victim_principal_id,
              weapon_id, weapon_model, hit_bone,
              damage_amount, mitigated_amount, net_damage,
              hit_x, hit_y, hit_z, replay_nonce, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
          [
            id,
            params.sessionId ?? null,
            params.attackerPrincipalId,
            params.victimPrincipalId,
            params.weaponId ?? null,
            params.weaponModel,
            params.hitBone,
            params.damageAmount,
            params.mitigatedAmount,
            params.netDamage,
            params.hitX ?? null,
            params.hitY ?? null,
            params.hitZ ?? null,
            params.replayNonce,
          ],
        )
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new DuplicateDamageError(params.replayNonce)
        }
        throw err
      }

      const [rows] = await conn.execute<DamageEventRow[]>(
        `SELECT * FROM atc_damage_events WHERE id = ? LIMIT 1`,
        [id],
      )
      return rowToDamageEvent(rows[0]!)
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcDamageEvent | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DamageEventRow[]>(
        `SELECT * FROM atc_damage_events WHERE id = ? LIMIT 1`,
        [id],
      )
      return rows[0] ? rowToDamageEvent(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listBySession(sessionId: string): Promise<AtcDamageEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DamageEventRow[]>(
        `SELECT * FROM atc_damage_events WHERE session_id = ? ORDER BY created_at ASC`,
        [sessionId],
      )
      return rows.map(rowToDamageEvent)
    } finally {
      conn.release()
    }
  }

  async listByVictim(victimPrincipalId: string, limit = 100): Promise<AtcDamageEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DamageEventRow[]>(
        `SELECT * FROM atc_damage_events
         WHERE victim_principal_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [victimPrincipalId, limit],
      )
      return rows.map(rowToDamageEvent)
    } finally {
      conn.release()
    }
  }

  async listByAttacker(attackerPrincipalId: string, limit = 100): Promise<AtcDamageEvent[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DamageEventRow[]>(
        `SELECT * FROM atc_damage_events
         WHERE attacker_principal_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [attackerPrincipalId, limit],
      )
      return rows.map(rowToDamageEvent)
    } finally {
      conn.release()
    }
  }
}
