import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { OrganizationMember, OrganizationMemberRole } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { generateId } from './id.js'
import type { OrganizationPool } from './pool.js'

interface MemberRow extends RowDataPacket {
  id: string
  organization_id: string
  character_id: string
  role: string
  joined_at: Date
  expires_at: Date | null
}

function rowToMember(row: MemberRow): OrganizationMember {
  return {
    id: row.id,
    organizationId: row.organization_id,
    characterId: row.character_id,
    role: row.role as OrganizationMemberRole,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
  }
}

export interface AddMemberParams {
  organizationId: string
  characterId: string
  role: OrganizationMemberRole
  expiresAt?: Date | undefined
}

export class MemberRepository {
  constructor(
    private readonly pool: OrganizationPool,
    private readonly telemetry?: AtcTelemetryService,
  ) {}

  async add(params: AddMemberParams): Promise<OrganizationMember> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      await conn.execute(
        `INSERT INTO atc_organization_members
           (id, organization_id, character_id, role, joined_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(3), ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role), expires_at = VALUES(expires_at)`,
        [id, params.organizationId, params.characterId, params.role, params.expiresAt ?? null],
      )
      this.telemetry?.increment('economy.members_added_total')
      const [rows] = await conn.execute<MemberRow[]>(
        `SELECT * FROM atc_organization_members
         WHERE organization_id = ? AND character_id = ? LIMIT 1`,
        [params.organizationId, params.characterId],
      )
      const member = rows[0]
      if (!member) throw new Error(`Member not found after upsert: ${params.characterId}`)
      return rowToMember(member)
    } finally {
      conn.release()
    }
  }

  async remove(organizationId: string, characterId: string): Promise<boolean> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_organization_members WHERE organization_id = ? AND character_id = ?`,
        [organizationId, characterId],
      )
      return result.affectedRows > 0
    } finally {
      conn.release()
    }
  }

  async listByOrganization(organizationId: string): Promise<OrganizationMember[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MemberRow[]>(
        `SELECT * FROM atc_organization_members
         WHERE organization_id = ? AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY joined_at ASC`,
        [organizationId],
      )
      return rows.map(rowToMember)
    } finally {
      conn.release()
    }
  }

  async findMember(organizationId: string, characterId: string): Promise<OrganizationMember | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MemberRow[]>(
        `SELECT * FROM atc_organization_members
         WHERE organization_id = ? AND character_id = ? LIMIT 1`,
        [organizationId, characterId],
      )
      return rows[0] ? rowToMember(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
