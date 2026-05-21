import type { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise'
import type { FactionPool } from './pool.js'
import { generateId } from './id.js'
import { TerritoryAlreadyClaimedError, TerritoryClaimNotFoundError, TerritoryClaimImmutableError } from './errors.js'

export type AtcClaimType = 'capture' | 'purchase' | 'grant' | 'inheritance'
export type AtcClaimStatus = 'active' | 'superseded' | 'released'

export interface AtcTerritoryClaim {
  id: string
  territoryId: string
  factionId: string
  claimedByPrincipalId: string
  claimType: AtcClaimType
  status: AtcClaimStatus
  claimNonce: string
  claimedAt: Date
  releasedAt: Date | null
  supersededAt: Date | null
  notes: string | null
}

interface TerritoryClaimRow extends RowDataPacket {
  id: string
  territory_id: string
  faction_id: string
  claimed_by_principal_id: string
  claim_type: string
  status: string
  claim_nonce: string
  claimed_at: Date
  released_at: Date | null
  superseded_at: Date | null
  notes: string | null
}

function rowToClaim(row: TerritoryClaimRow): AtcTerritoryClaim {
  return {
    id: row.id,
    territoryId: row.territory_id,
    factionId: row.faction_id,
    claimedByPrincipalId: row.claimed_by_principal_id,
    claimType: row.claim_type as AtcClaimType,
    status: row.status as AtcClaimStatus,
    claimNonce: row.claim_nonce,
    claimedAt: row.claimed_at,
    releasedAt: row.released_at,
    supersededAt: row.superseded_at,
    notes: row.notes,
  }
}

const ALLOWED_CLAIM_TRANSITIONS: Record<AtcClaimStatus, AtcClaimStatus[]> = {
  active: ['superseded', 'released'],
  superseded: [],
  released: [],
}

export interface CreateClaimParams {
  territoryId: string
  factionId: string
  claimedByPrincipalId: string
  claimType?: AtcClaimType
  claimNonce: string
  notes?: string | null | undefined
}

export interface TransitionClaimOpts {
  notes?: string | null | undefined
}

export class TerritoryClaimRepository {
  constructor(private readonly pool: FactionPool) {}

  async create(params: CreateClaimParams): Promise<AtcTerritoryClaim> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [existingRows] = await conn.execute<TerritoryClaimRow[]>(
        "SELECT * FROM atc_territory_claims WHERE territory_id = ? AND status = 'active' FOR UPDATE",
        [params.territoryId],
      )
      if (existingRows[0]) {
        await conn.rollback()
        throw new TerritoryAlreadyClaimedError(params.territoryId, existingRows[0].faction_id)
      }

      const id = generateId()
      const claimType = params.claimType ?? 'capture'
      const notes = params.notes ?? null
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_territory_claims
             (id, territory_id, faction_id, claimed_by_principal_id, claim_type, status, claim_nonce, claimed_at, released_at, superseded_at, notes)
           VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(3), NULL, NULL, ?)`,
          [id, params.territoryId, params.factionId, params.claimedByPrincipalId, claimType, params.claimNonce, notes],
        )
      } catch (err: unknown) {
        await conn.rollback()
        if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
          throw new TerritoryAlreadyClaimedError(params.territoryId, params.factionId)
        }
        throw err
      }

      const [rows] = await conn.execute<TerritoryClaimRow[]>(
        'SELECT * FROM atc_territory_claims WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToClaim(rows[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcTerritoryClaim | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryClaimRow[]>(
        'SELECT * FROM atc_territory_claims WHERE id = ? LIMIT 1',
        [id],
      )
      return rows[0] ? rowToClaim(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findActiveClaim(territoryId: string): Promise<AtcTerritoryClaim | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryClaimRow[]>(
        "SELECT * FROM atc_territory_claims WHERE territory_id = ? AND status = 'active' LIMIT 1",
        [territoryId],
      )
      return rows[0] ? rowToClaim(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listByFaction(factionId: string): Promise<AtcTerritoryClaim[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<TerritoryClaimRow[]>(
        'SELECT * FROM atc_territory_claims WHERE faction_id = ? ORDER BY claimed_at DESC',
        [factionId],
      )
      return rows.map(rowToClaim)
    } finally {
      conn.release()
    }
  }

  async transition(id: string, status: AtcClaimStatus, opts?: TransitionClaimOpts): Promise<AtcTerritoryClaim> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()

      const [rows] = await conn.execute<TerritoryClaimRow[]>(
        'SELECT * FROM atc_territory_claims WHERE id = ? FOR UPDATE',
        [id],
      )
      const row = rows[0]
      if (!row) {
        await conn.rollback()
        throw new TerritoryClaimNotFoundError(id)
      }

      const current = row.status as AtcClaimStatus
      const allowed = ALLOWED_CLAIM_TRANSITIONS[current]
      if (!allowed.includes(status)) {
        await conn.rollback()
        throw new TerritoryClaimImmutableError(id, current, status)
      }

      const notes = opts?.notes ?? null
      const releasedAt = status === 'released' ? 'NOW(3)' : 'NULL'
      const supersededAt = status === 'superseded' ? 'NOW(3)' : 'NULL'

      await conn.execute(
        `UPDATE atc_territory_claims
         SET status = ?, released_at = ${releasedAt}, superseded_at = ${supersededAt}, notes = COALESCE(?, notes)
         WHERE id = ?`,
        [status, notes, id],
      )

      const [updated] = await conn.execute<TerritoryClaimRow[]>(
        'SELECT * FROM atc_territory_claims WHERE id = ? LIMIT 1',
        [id],
      )
      await conn.commit()
      return rowToClaim(updated[0]!)
    } catch (err) {
      try { await conn.rollback() } catch { /* ignore */ }
      throw err
    } finally {
      conn.release()
    }
  }
}
