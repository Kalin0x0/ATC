import type { RowDataPacket } from 'mysql2/promise'
import { generateId } from './id.js'
import type { ReputationRuntimePool } from './pool.js'

export interface AtcReputationDecay {
  id: string
  principalId: string
  factionId: string | null
  decayRate: number
  nextDecayAt: Date
  lastDecayedAt: Date | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

interface ReputationDecayRow extends RowDataPacket {
  id: string
  principal_id: string
  faction_id: string | null
  decay_rate: number
  next_decay_at: Date
  last_decayed_at: Date | null
  is_active: number
  created_at: Date
  updated_at: Date
}

function mapRow(row: ReputationDecayRow): AtcReputationDecay {
  return {
    id: row.id,
    principalId: row.principal_id,
    factionId: row.faction_id ?? null,
    decayRate: Number(row.decay_rate),
    nextDecayAt: new Date(row.next_decay_at),
    lastDecayedAt: row.last_decayed_at ? new Date(row.last_decayed_at) : null,
    isActive: Boolean(row.is_active),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

export class ReputationDecayRepository {
  constructor(private readonly pool: ReputationRuntimePool) {}

  async findByPrincipalAndFaction(
    principalId: string,
    factionId: string | null,
  ): Promise<AtcReputationDecay | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReputationDecayRow[]>(
        factionId !== null
          ? 'SELECT * FROM atc_reputation_decay WHERE principal_id = ? AND faction_id = ? LIMIT 1'
          : 'SELECT * FROM atc_reputation_decay WHERE principal_id = ? AND faction_id IS NULL LIMIT 1',
        factionId !== null ? [principalId, factionId] : [principalId],
      )
      const row = rows[0]
      return row !== undefined ? mapRow(row) : null
    } finally {
      conn.release()
    }
  }

  async listDue(): Promise<AtcReputationDecay[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ReputationDecayRow[]>(
        'SELECT * FROM atc_reputation_decay WHERE is_active = 1 AND next_decay_at <= NOW(3)',
        [],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async upsert(
    principalId: string,
    factionId: string | null,
    decayRate: number,
    nextDecayAt: Date,
  ): Promise<AtcReputationDecay> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const nextDecayAtStr = nextDecayAt.toISOString()
      await conn.execute<ReputationDecayRow[]>(
        `INSERT INTO atc_reputation_decay
           (id, principal_id, faction_id, decay_rate, next_decay_at, last_decayed_at, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, 1, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           decay_rate = ?,
           next_decay_at = ?,
           is_active = 1,
           updated_at = NOW(3)`,
        [id, principalId, factionId, decayRate, nextDecayAtStr, decayRate, nextDecayAtStr],
      )
      const record = await this.findByPrincipalAndFaction(principalId, factionId)
      return record!
    } finally {
      conn.release()
    }
  }

  async markDecayed(
    principalId: string,
    factionId: string | null,
    nextDecayAt: Date,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const nextDecayAtStr = nextDecayAt.toISOString()
      if (factionId !== null) {
        await conn.execute<ReputationDecayRow[]>(
          `UPDATE atc_reputation_decay
           SET last_decayed_at = NOW(3), next_decay_at = ?, updated_at = NOW(3)
           WHERE principal_id = ? AND faction_id = ?`,
          [nextDecayAtStr, principalId, factionId],
        )
      } else {
        await conn.execute<ReputationDecayRow[]>(
          `UPDATE atc_reputation_decay
           SET last_decayed_at = NOW(3), next_decay_at = ?, updated_at = NOW(3)
           WHERE principal_id = ? AND faction_id IS NULL`,
          [nextDecayAtStr, principalId],
        )
      }
    } finally {
      conn.release()
    }
  }

  async setActive(
    principalId: string,
    factionId: string | null,
    isActive: boolean,
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const activeVal = isActive ? 1 : 0
      if (factionId !== null) {
        await conn.execute<ReputationDecayRow[]>(
          'UPDATE atc_reputation_decay SET is_active = ?, updated_at = NOW(3) WHERE principal_id = ? AND faction_id = ?',
          [activeVal, principalId, factionId],
        )
      } else {
        await conn.execute<ReputationDecayRow[]>(
          'UPDATE atc_reputation_decay SET is_active = ?, updated_at = NOW(3) WHERE principal_id = ? AND faction_id IS NULL',
          [activeVal, principalId],
        )
      }
    } finally {
      conn.release()
    }
  }

  async deleteByPrincipal(principalId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute<ReputationDecayRow[]>(
        'DELETE FROM atc_reputation_decay WHERE principal_id = ?',
        [principalId],
      )
    } finally {
      conn.release()
    }
  }
}
