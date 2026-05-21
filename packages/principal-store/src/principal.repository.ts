import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type {
  AtcPrincipal,
  AtcPrincipalType,
  AtcPluginTrustLevel,
  AtcPermission,
  StoredPrincipal,
  PrincipalStatus,
} from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { PrincipalStorePool } from './pool.js'

// ── Row types ─────────────────────────────────────────────────────────────────

interface PrincipalRow extends RowDataPacket {
  id: string
  principal_type: string
  status: string
  display_name: string
  account_id: string | null
  trust_level: string | null
  direct_permissions: string // JSON
  direct_denies: string      // JSON
  metadata: string | null    // JSON
  created_at: Date
  updated_at: Date
}

interface RoleRow extends RowDataPacket {
  role_id: string
}

interface CapabilityRow extends RowDataPacket {
  capability: string
}

// ── Params ────────────────────────────────────────────────────────────────────

export interface CreatePrincipalParams {
  type: AtcPrincipalType
  displayName: string
  accountId?: string
  trustLevel?: AtcPluginTrustLevel
  metadata?: Record<string, string>
}

export interface UpdatePrincipalParams {
  displayName?: string
  trustLevel?: AtcPluginTrustLevel | null
  metadata?: Record<string, string> | null
}

export interface ListPrincipalsParams {
  limit?: number
  offset?: number
  type?: AtcPrincipalType
  status?: PrincipalStatus
  accountId?: string
}

export interface PrincipalPage {
  items: StoredPrincipal[]
  total: number
  offset: number
  limit: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToStored(row: PrincipalRow): StoredPrincipal {
  return {
    id: row.id,
    type: row.principal_type as AtcPrincipalType,
    status: row.status as PrincipalStatus,
    displayName: row.display_name,
    accountId: row.account_id,
    trustLevel: (row.trust_level ?? null) as AtcPluginTrustLevel | null,
    directPermissions: _parseJsonArray(row.direct_permissions) as AtcPermission[],
    directDenies: _parseJsonArray(row.direct_denies) as AtcPermission[],
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, string> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function _parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ── Repository ────────────────────────────────────────────────────────────────

export class PrincipalRepository {
  constructor(
    private readonly pool: PrincipalStorePool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async create(params: CreatePrincipalParams): Promise<StoredPrincipal> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_principals
           (id, principal_type, status, display_name, account_id, trust_level,
            direct_permissions, direct_denies, metadata, created_at, updated_at)
         VALUES (?, ?, 'active', ?, ?, ?, JSON_ARRAY(), JSON_ARRAY(), ?, NOW(3), NOW(3))`,
        [
          id,
          params.type,
          params.displayName,
          params.accountId ?? null,
          params.trustLevel ?? null,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      this.telemetry?.increment('iam.principal_created_total')
      const result = await this._findById(conn, id)
      if (!result) throw new Error(`Principal not found after insert: ${id}`)
      return result
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<StoredPrincipal | null> {
    const conn = await this.pool.getConnection()
    try {
      return await this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findByAccountId(accountId: string): Promise<StoredPrincipal | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PrincipalRow[]>(
        `SELECT * FROM atc_principals
         WHERE account_id = ? AND status = 'active'
         ORDER BY created_at ASC
         LIMIT 1`,
        [accountId],
      )
      return rows[0] ? rowToStored(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async list(params: ListPrincipalsParams = {}): Promise<PrincipalPage> {
    const limit = params.limit ?? 20
    const offset = params.offset ?? 0
    const conditions: string[] = []
    const filterArgs: string[] = []

    if (params.type) { conditions.push('principal_type = ?'); filterArgs.push(params.type) }
    if (params.status) { conditions.push('status = ?'); filterArgs.push(params.status) }
    if (params.accountId) { conditions.push('account_id = ?'); filterArgs.push(params.accountId) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const conn = await this.pool.getConnection()
    try {
      const [countRows] = await conn.execute<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM atc_principals ${where}`,
        filterArgs,
      )
      const total = countRows[0]?.total ?? 0

      const [rows] = await conn.execute<PrincipalRow[]>(
        `SELECT * FROM atc_principals ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...filterArgs, limit, offset],
      )

      return { items: rows.map(rowToStored), total, offset, limit }
    } finally {
      conn.release()
    }
  }

  async update(id: string, patch: UpdatePrincipalParams): Promise<StoredPrincipal | null> {
    const sets: string[] = ['updated_at = NOW(3)']
    const updateArgs: (string | null)[] = []

    if (patch.displayName !== undefined) { sets.push('display_name = ?'); updateArgs.push(patch.displayName) }
    if (patch.trustLevel !== undefined) { sets.push('trust_level = ?'); updateArgs.push(patch.trustLevel ?? null) }
    if (patch.metadata !== undefined) {
      sets.push('metadata = ?')
      updateArgs.push(patch.metadata !== null ? JSON.stringify(patch.metadata) : null)
    }

    if (sets.length === 1) return this.findById(id) // nothing to update

    updateArgs.push(id)
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_principals SET ${sets.join(', ')} WHERE id = ?`,
        updateArgs,
      )
      this.telemetry?.increment('iam.principal_updated_total')
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async disable(id: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_principals SET status = 'disabled', updated_at = NOW(3)
         WHERE id = ? AND status != 'disabled'`,
        [id],
      )
      if (result.affectedRows > 0) {
        this.telemetry?.increment('iam.principal_disabled_total')
      }
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  /**
   * Resolves a full AtcPrincipal from the DB — fetches the stored record,
   * all non-expired role assignments, and all non-expired capability assignments.
   * Returns null if the principal does not exist or is disabled/suspended.
   */
  async resolve(id: string): Promise<AtcPrincipal | null> {
    const conn = await this.pool.getConnection()
    try {
      const stored = await this._findById(conn, id)
      if (!stored || stored.status !== 'active') return null

      const [roleRows] = await conn.execute<RoleRow[]>(
        `SELECT role_id FROM atc_role_assignments
         WHERE principal_id = ? AND (expires_at IS NULL OR expires_at > NOW(3))`,
        [id],
      )

      const [capRows] = await conn.execute<CapabilityRow[]>(
        `SELECT capability FROM atc_capability_assignments
         WHERE principal_id = ? AND (expires_at IS NULL OR expires_at > NOW(3))`,
        [id],
      )

      this.telemetry?.increment('iam.principal_resolved_total')

      const principal: AtcPrincipal = {
        id: stored.id,
        type: stored.type,
        roles: roleRows.map((r) => r.role_id),
        permissions: stored.directPermissions,
        capabilities: capRows.map((c) => c.capability) as AtcPrincipal['capabilities'],
        denies: stored.directDenies,
        ...(stored.trustLevel !== null ? { trustLevel: stored.trustLevel } : {}),
        ...(stored.metadata !== null ? { metadata: stored.metadata } : {}),
      }

      return principal
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<PrincipalStorePool['getConnection']>>,
    id: string,
  ): Promise<StoredPrincipal | null> {
    const [rows] = await conn.execute<PrincipalRow[]>(
      'SELECT * FROM atc_principals WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? rowToStored(rows[0]) : null
  }
}
