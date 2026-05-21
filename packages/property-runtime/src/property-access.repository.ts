import type { RowDataPacket } from 'mysql2/promise'
import type { AtcPropertyAccess, AtcPropertyAccessType, AtcPropertyKey } from '@atc/shared-types'
import type { PropertyPool } from './pool.js'
import { generateId } from './id.js'
import {
  PropertyAccessNotFoundError,
  PropertyKeyNotFoundError,
  PropertyAccessConflictError,
  PropertyKeyAlreadyIssuedError,
} from './errors.js'

interface AccessRow extends RowDataPacket {
  id: string
  property_id: string
  principal_id: string
  access_type: string
  granted_by_principal_id: string
  expires_at: Date | null
  revoked_at: Date | null
  revoked_by_principal_id: string | null
  granted_at: Date
}

interface KeyRow extends RowDataPacket {
  id: string
  property_id: string
  issued_to_principal_id: string
  issued_by_principal_id: string
  issued_at: Date
  revoked_at: Date | null
  revoked_by_principal_id: string | null
}

function rowToAccess(row: AccessRow): AtcPropertyAccess {
  return {
    id: row.id,
    propertyId: row.property_id,
    principalId: row.principal_id,
    accessType: row.access_type as AtcPropertyAccessType,
    grantedByPrincipalId: row.granted_by_principal_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedByPrincipalId: row.revoked_by_principal_id,
    grantedAt: row.granted_at,
  }
}

function rowToKey(row: KeyRow): AtcPropertyKey {
  return {
    id: row.id,
    propertyId: row.property_id,
    issuedToPrincipalId: row.issued_to_principal_id,
    issuedByPrincipalId: row.issued_by_principal_id,
    issuedAt: row.issued_at,
    revokedAt: row.revoked_at,
    revokedByPrincipalId: row.revoked_by_principal_id,
  }
}

export interface GrantAccessParams {
  propertyId: string
  principalId: string
  accessType: AtcPropertyAccessType
  grantedByPrincipalId: string
  expiresInSeconds?: number | undefined
}

export class PropertyAccessRepository {
  constructor(private readonly pool: PropertyPool) {}

  async grant(params: GrantAccessParams): Promise<AtcPropertyAccess> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        // Lock: prevent duplicate active grants of the same type for the same principal
        const [existing] = await conn.execute<AccessRow[]>(
          `SELECT id FROM atc_property_access
           WHERE property_id = ? AND principal_id = ? AND access_type = ?
             AND revoked_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [params.propertyId, params.principalId, params.accessType],
        )
        if (existing.length > 0) {
          throw new PropertyAccessConflictError(params.propertyId, params.principalId, params.accessType)
        }

        await conn.execute(
          `INSERT INTO atc_property_access
             (id, property_id, principal_id, access_type, granted_by_principal_id,
              expires_at, granted_at)
           VALUES (?, ?, ?, ?, ?,
             ${params.expiresInSeconds ? `DATE_ADD(NOW(3), INTERVAL ? SECOND)` : 'NULL'},
             NOW(3))`,
          params.expiresInSeconds
            ? [id, params.propertyId, params.principalId, params.accessType,
               params.grantedByPrincipalId, params.expiresInSeconds]
            : [id, params.propertyId, params.principalId, params.accessType,
               params.grantedByPrincipalId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<AccessRow[]>(
        `SELECT * FROM atc_property_access WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PropertyAccessNotFoundError(id)
      return rowToAccess(rows[0])
    } finally {
      conn.release()
    }
  }

  async revoke(accessId: string, revokedByPrincipalId: string): Promise<AtcPropertyAccess> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<AccessRow[]>(
          `SELECT * FROM atc_property_access WHERE id = ? LIMIT 1 FOR UPDATE`,
          [accessId],
        )
        if (!rows[0]) throw new PropertyAccessNotFoundError(accessId)

        await conn.execute(
          `UPDATE atc_property_access
           SET revoked_at = NOW(3), revoked_by_principal_id = ?
           WHERE id = ?`,
          [revokedByPrincipalId, accessId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<AccessRow[]>(
        `SELECT * FROM atc_property_access WHERE id = ? LIMIT 1`,
        [accessId],
      )
      if (!rows[0]) throw new PropertyAccessNotFoundError(accessId)
      return rowToAccess(rows[0])
    } finally {
      conn.release()
    }
  }

  async findActiveForPrincipal(
    propertyId: string,
    principalId: string,
  ): Promise<AtcPropertyAccess[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AccessRow[]>(
        `SELECT * FROM atc_property_access
         WHERE property_id = ? AND principal_id = ?
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY granted_at DESC`,
        [propertyId, principalId],
      )
      return rows.map(rowToAccess)
    } finally {
      conn.release()
    }
  }

  async listActiveForProperty(propertyId: string): Promise<AtcPropertyAccess[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AccessRow[]>(
        `SELECT * FROM atc_property_access
         WHERE property_id = ? AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW(3))
         ORDER BY granted_at DESC`,
        [propertyId],
      )
      return rows.map(rowToAccess)
    } finally {
      conn.release()
    }
  }

  // ── Key methods ───────────────────────────────────────────────────────────────

  async issueKey(
    propertyId: string,
    issuedToPrincipalId: string,
    issuedByPrincipalId: string,
  ): Promise<AtcPropertyKey> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [existing] = await conn.execute<KeyRow[]>(
          `SELECT id FROM atc_property_keys
           WHERE property_id = ? AND issued_to_principal_id = ? AND revoked_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [propertyId, issuedToPrincipalId],
        )
        if (existing.length > 0) {
          throw new PropertyKeyAlreadyIssuedError(propertyId, issuedToPrincipalId)
        }

        await conn.execute(
          `INSERT INTO atc_property_keys
             (id, property_id, issued_to_principal_id, issued_by_principal_id, issued_at)
           VALUES (?, ?, ?, ?, NOW(3))`,
          [id, propertyId, issuedToPrincipalId, issuedByPrincipalId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<KeyRow[]>(
        `SELECT * FROM atc_property_keys WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PropertyKeyNotFoundError(id)
      return rowToKey(rows[0])
    } finally {
      conn.release()
    }
  }

  async revokeKey(keyId: string, revokedByPrincipalId: string): Promise<AtcPropertyKey> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<KeyRow[]>(
          `SELECT * FROM atc_property_keys WHERE id = ? LIMIT 1 FOR UPDATE`,
          [keyId],
        )
        if (!rows[0]) throw new PropertyKeyNotFoundError(keyId)

        await conn.execute(
          `UPDATE atc_property_keys
           SET revoked_at = NOW(3), revoked_by_principal_id = ?
           WHERE id = ?`,
          [revokedByPrincipalId, keyId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<KeyRow[]>(
        `SELECT * FROM atc_property_keys WHERE id = ? LIMIT 1`,
        [keyId],
      )
      if (!rows[0]) throw new PropertyKeyNotFoundError(keyId)
      return rowToKey(rows[0])
    } finally {
      conn.release()
    }
  }

  async listActiveKeysForProperty(propertyId: string): Promise<AtcPropertyKey[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<KeyRow[]>(
        `SELECT * FROM atc_property_keys
         WHERE property_id = ? AND revoked_at IS NULL
         ORDER BY issued_at DESC`,
        [propertyId],
      )
      return rows.map(rowToKey)
    } finally {
      conn.release()
    }
  }

  async findActiveKeyForPrincipal(
    propertyId: string,
    principalId: string,
  ): Promise<AtcPropertyKey | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<KeyRow[]>(
        `SELECT * FROM atc_property_keys
         WHERE property_id = ? AND issued_to_principal_id = ? AND revoked_at IS NULL
         LIMIT 1`,
        [propertyId, principalId],
      )
      return rows[0] ? rowToKey(rows[0]) : null
    } finally {
      conn.release()
    }
  }
}
