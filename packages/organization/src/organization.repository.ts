import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type {
  Organization,
  OrganizationType,
  OrganizationStatus,
} from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { OrganizationPool } from './pool.js'

interface OrgRow extends RowDataPacket {
  id: string
  name: string
  display_name: string
  type: string
  status: string
  treasury_account_id: string | null
  owner_id: string
  metadata: string | null
  created_at: Date
  updated_at: Date
}

function rowToOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    type: row.type as OrganizationType,
    status: row.status as OrganizationStatus,
    treasuryAccountId: row.treasury_account_id,
    ownerId: row.owner_id,
    metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, string> : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateOrganizationParams {
  name: string
  displayName: string
  type: OrganizationType
  ownerId: string
  treasuryAccountId?: string | undefined
  metadata?: Record<string, string> | undefined
}

export interface UpdateOrganizationParams {
  displayName?: string
  status?: OrganizationStatus
  treasuryAccountId?: string | null
  metadata?: Record<string, string> | null
}

export class OrganizationRepository {
  constructor(
    private readonly pool: OrganizationPool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async create(params: CreateOrganizationParams): Promise<Organization> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_organizations
           (id, name, display_name, type, status, treasury_account_id, owner_id, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3))`,
        [
          id,
          params.name,
          params.displayName,
          params.type,
          params.treasuryAccountId ?? null,
          params.ownerId,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      )
      this.telemetry?.increment('economy.organizations_created_total')
      const org = await this._findById(conn, id)
      if (!org) throw new Error(`Organization not found after insert: ${id}`)
      return org
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<Organization | null> {
    const conn = await this.pool.getConnection()
    try {
      return await this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  async findByName(name: string): Promise<Organization | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<OrgRow[]>(
        'SELECT * FROM atc_organizations WHERE name = ? LIMIT 1',
        [name],
      )
      return rows[0] ? rowToOrg(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async update(id: string, patch: UpdateOrganizationParams): Promise<Organization | null> {
    const sets: string[] = ['updated_at = NOW(3)']
    const updateArgs: (string | null)[] = []

    if (patch.displayName !== undefined) { sets.push('display_name = ?'); updateArgs.push(patch.displayName) }
    if (patch.status !== undefined)      { sets.push('status = ?');       updateArgs.push(patch.status) }
    if (patch.treasuryAccountId !== undefined) {
      sets.push('treasury_account_id = ?')
      updateArgs.push(patch.treasuryAccountId ?? null)
    }
    if (patch.metadata !== undefined) {
      sets.push('metadata = ?')
      updateArgs.push(patch.metadata !== null ? JSON.stringify(patch.metadata) : null)
    }

    if (sets.length === 1) return this.findById(id)

    updateArgs.push(id)
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE atc_organizations SET ${sets.join(', ')} WHERE id = ?`,
        updateArgs,
      )
      if (result.affectedRows === 0) return null
      return this._findById(conn, id)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<OrganizationPool['getConnection']>>,
    id: string,
  ): Promise<Organization | null> {
    const [rows] = await conn.execute<OrgRow[]>(
      'SELECT * FROM atc_organizations WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? rowToOrg(rows[0]) : null
  }
}
