import type { RowDataPacket } from 'mysql2/promise'
import type { DbPool } from '../client.js'
import type { AtcVitalName, AtcVitalsMutationMode, AtcCharacterVitals } from '@atc/shared-types'

// ── Row type ──────────────────────────────────────────────────────────────────

interface VitalsRow extends RowDataPacket {
  character_id: string
  health:       number
  hunger:       number
  thirst:       number
  stamina:      number
  stress:       number
  armor:        number
  created_at:   Date
  updated_at:   Date
}

// ── Whitelist of column names — prevents SQL injection in dynamic SET clauses ──

const VITAL_COLUMNS: Record<AtcVitalName, string> = {
  health:  'health',
  hunger:  'hunger',
  thirst:  'thirst',
  stamina: 'stamina',
  stress:  'stress',
  armor:   'armor',
}

// ── Row mapper ─────────────────────────────────────────────────────────────────

function rowToVitals(row: VitalsRow): AtcCharacterVitals {
  return {
    characterId: row.character_id,
    health:      row.health,
    hunger:      row.hunger,
    thirst:      row.thirst,
    stamina:     row.stamina,
    stress:      row.stress,
    armor:       row.armor,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }
}

// ── VitalsRecord export type ───────────────────────────────────────────────────

export type VitalsRecord = AtcCharacterVitals

// ── Repository ────────────────────────────────────────────────────────────────

export class VitalsRepository {
  constructor(private readonly pool: DbPool) {}

  // Get vitals row, creating default row if none exists.
  // Handles concurrent first-creation race via ER_DUP_ENTRY retry.
  async getOrCreate(characterId: string): Promise<VitalsRecord> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VitalsRow[]>(
        'SELECT * FROM atc_character_vitals WHERE character_id = ? LIMIT 1',
        [characterId],
      )
      if (rows[0]) return rowToVitals(rows[0])

      try {
        await conn.execute(
          'INSERT INTO atc_character_vitals (character_id) VALUES (?)',
          [characterId],
        )
      } catch (err) {
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          const [retried] = await conn.execute<VitalsRow[]>(
            'SELECT * FROM atc_character_vitals WHERE character_id = ? LIMIT 1',
            [characterId],
          )
          if (retried[0]) return rowToVitals(retried[0])
        }
        throw err
      }

      const [created] = await conn.execute<VitalsRow[]>(
        'SELECT * FROM atc_character_vitals WHERE character_id = ? LIMIT 1',
        [characterId],
      )
      return rowToVitals(created[0]!)
    } finally {
      conn.release()
    }
  }

  // Patch one or multiple vitals. Values are clamped 0–100 by MariaDB LEAST/GREATEST.
  // Auto-creates the vitals row if it does not exist (INSERT ON DUPLICATE KEY UPDATE).
  async patch(
    characterId: string,
    patch: Partial<Record<AtcVitalName, number>>,
  ): Promise<VitalsRecord> {
    const entries = (Object.entries(patch) as [AtcVitalName, number | undefined][]).filter(
      ([, v]) => v !== undefined,
    ) as [AtcVitalName, number][]

    if (entries.length === 0) throw new Error('Patch must include at least one vital field')

    const setClauses: string[] = []
    const values: (string | number)[] = []

    for (const [vital, value] of entries) {
      const col = VITAL_COLUMNS[vital]
      // col is always defined because AtcVitalName is the union of VITAL_COLUMNS keys
      setClauses.push(`${col} = LEAST(100, GREATEST(0, ?))`)
      values.push(value)
    }

    const conn = await this.pool.getConnection()
    try {
      // Ensure row exists without overwriting existing data
      await conn.execute(
        'INSERT INTO atc_character_vitals (character_id) VALUES (?) ON DUPLICATE KEY UPDATE character_id = character_id',
        [characterId],
      )
      await conn.execute(
        `UPDATE atc_character_vitals SET ${setClauses.join(', ')} WHERE character_id = ?`,
        [...values, characterId],
      )
      const [rows] = await conn.execute<VitalsRow[]>(
        'SELECT * FROM atc_character_vitals WHERE character_id = ? LIMIT 1',
        [characterId],
      )
      return rowToVitals(rows[0]!)
    } finally {
      conn.release()
    }
  }

  // Mutate a single vital using set/increment/decrement with server-side clamping.
  // Uses FOR UPDATE row lock to prevent concurrent mutation races.
  async mutate(
    characterId: string,
    vitalName: AtcVitalName,
    mode: AtcVitalsMutationMode,
    amount: number,
  ): Promise<VitalsRecord> {
    const col = VITAL_COLUMNS[vitalName]

    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      // Upsert default row (no-op if already exists)
      await conn.execute(
        'INSERT INTO atc_character_vitals (character_id) VALUES (?) ON DUPLICATE KEY UPDATE character_id = character_id',
        [characterId],
      )

      // Acquire row lock before mutating
      await conn.execute<VitalsRow[]>(
        'SELECT * FROM atc_character_vitals WHERE character_id = ? FOR UPDATE',
        [characterId],
      )

      let updateSQL: string
      if (mode === 'set') {
        updateSQL = `UPDATE atc_character_vitals SET ${col} = LEAST(100, GREATEST(0, ?)) WHERE character_id = ?`
      } else if (mode === 'increment') {
        updateSQL = `UPDATE atc_character_vitals SET ${col} = LEAST(100, ${col} + ?) WHERE character_id = ?`
      } else {
        updateSQL = `UPDATE atc_character_vitals SET ${col} = GREATEST(0, ${col} - ?) WHERE character_id = ?`
      }

      await conn.execute(updateSQL, [amount, characterId])
      await conn.commit()

      const [rows] = await conn.execute<VitalsRow[]>(
        'SELECT * FROM atc_character_vitals WHERE character_id = ? LIMIT 1',
        [characterId],
      )
      return rowToVitals(rows[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  // Reset all vitals to their default values (health=100, hunger=100, thirst=100,
  // stamina=100, stress=0, armor=0). Creates the row if it does not exist.
  async reset(characterId: string): Promise<VitalsRecord> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_character_vitals (character_id, health, hunger, thirst, stamina, stress, armor)
         VALUES (?, 100, 100, 100, 100, 0, 0)
         ON DUPLICATE KEY UPDATE
           health = 100, hunger = 100, thirst = 100,
           stamina = 100, stress = 0, armor = 0`,
        [characterId],
      )
      const [rows] = await conn.execute<VitalsRow[]>(
        'SELECT * FROM atc_character_vitals WHERE character_id = ? LIMIT 1',
        [characterId],
      )
      return rowToVitals(rows[0]!)
    } finally {
      conn.release()
    }
  }
}
