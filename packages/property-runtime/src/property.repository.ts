import type { RowDataPacket } from 'mysql2/promise'
import type { AtcProperty, AtcPropertyStatus, AtcPropertyAlarmState } from '@atc/shared-types'
import type { PropertyPool } from './pool.js'
import { generateId } from './id.js'
import {
  PropertyNotFoundError,
  PropertyImmutableError,
  PropertyAlreadyOwnedError,
} from './errors.js'

const ALLOWED_TRANSITIONS: Record<AtcPropertyStatus, AtcPropertyStatus[]> = {
  available:  ['owned'],
  owned:      ['occupied', 'locked', 'seized', 'abandoned'],
  occupied:   ['owned', 'locked', 'breached', 'seized'],
  locked:     ['owned', 'occupied', 'breached', 'seized'],
  breached:   ['owned', 'occupied', 'locked', 'seized'],
  seized:     ['owned', 'available'],
  abandoned:  ['available', 'owned'],
}

interface PropertyRow extends RowDataPacket {
  id: string
  owner_id: string | null
  organization_id: string | null
  name: string
  address: string
  interior_type: string
  shell_id: string | null
  status: string
  is_locked: number
  alarm_state: string
  storage_capacity: number
  notes: string | null
  seized_by_principal_id: string | null
  seized_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToProperty(row: PropertyRow): AtcProperty {
  return {
    id: row.id,
    ownerId: row.owner_id,
    organizationId: row.organization_id,
    name: row.name,
    address: row.address,
    interiorType: row.interior_type,
    shellId: row.shell_id,
    status: row.status as AtcPropertyStatus,
    isLocked: row.is_locked === 1,
    alarmState: row.alarm_state as AtcPropertyAlarmState,
    storageCapacity: row.storage_capacity,
    notes: row.notes,
    seizedByPrincipalId: row.seized_by_principal_id,
    seizedAt: row.seized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreatePropertyParams {
  name: string
  address: string
  interiorType: string
  shellId?: string | null | undefined
  ownerId?: string | null | undefined
  organizationId?: string | null | undefined
  storageCapacity?: number | undefined
  notes?: string | null | undefined
}

export interface TransitionPropertyParams {
  id: string
  newStatus: AtcPropertyStatus
  ownerId?: string | null | undefined
  organizationId?: string | null | undefined
  seizedByPrincipalId?: string | null | undefined
  seizedAt?: Date | null | undefined
}

export class PropertyRepository {
  constructor(private readonly pool: PropertyPool) {}

  async create(params: CreatePropertyParams): Promise<AtcProperty> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_properties
           (id, owner_id, organization_id, name, address, interior_type, shell_id,
            status, is_locked, alarm_state, storage_capacity, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'available', 0, 'off', ?, ?, NOW(3), NOW(3))`,
        [
          id,
          params.ownerId ?? null,
          params.organizationId ?? null,
          params.name,
          params.address,
          params.interiorType,
          params.shellId ?? null,
          params.storageCapacity ?? 100,
          params.notes ?? null,
        ],
      )
      const prop = await this._findById(conn, id)
      if (!prop) throw new PropertyNotFoundError(id)
      return prop
    } finally {
      conn.release()
    }
  }

  async transition(params: TransitionPropertyParams): Promise<AtcProperty> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<PropertyRow[]>(
          `SELECT * FROM atc_properties WHERE id = ? LIMIT 1 FOR UPDATE`,
          [params.id],
        )
        if (!rows[0]) throw new PropertyNotFoundError(params.id)
        const current = rowToProperty(rows[0])

        const allowed = ALLOWED_TRANSITIONS[current.status]
        if (!allowed.includes(params.newStatus)) {
          throw new PropertyImmutableError(params.id, current.status, params.newStatus)
        }

        if (params.newStatus === 'owned' && current.status === 'available') {
          if (current.ownerId !== null) throw new PropertyAlreadyOwnedError(params.id)
        }

        await conn.execute(
          `UPDATE atc_properties
           SET status                  = ?,
               owner_id                = COALESCE(?, owner_id),
               organization_id         = COALESCE(?, organization_id),
               seized_by_principal_id  = ?,
               seized_at               = ?,
               updated_at              = NOW(3)
           WHERE id = ?`,
          [
            params.newStatus,
            params.ownerId ?? null,
            params.organizationId ?? null,
            params.seizedByPrincipalId ?? null,
            params.seizedAt ?? null,
            params.id,
          ],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const prop = await this._findById(conn, params.id)
      if (!prop) throw new PropertyNotFoundError(params.id)
      return prop
    } finally {
      conn.release()
    }
  }

  async setLock(propertyId: string, isLocked: boolean): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_properties SET is_locked = ?, updated_at = NOW(3) WHERE id = ?`,
        [isLocked ? 1 : 0, propertyId],
      )
    } finally {
      conn.release()
    }
  }

  async setAlarm(propertyId: string, alarmState: AtcPropertyAlarmState): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_properties SET alarm_state = ?, updated_at = NOW(3) WHERE id = ?`,
        [alarmState, propertyId],
      )
    } finally {
      conn.release()
    }
  }

  async findById(propertyId: string): Promise<AtcProperty | null> {
    const conn = await this.pool.getConnection()
    try {
      return this._findById(conn, propertyId)
    } finally {
      conn.release()
    }
  }

  async findByStatus(status: AtcPropertyStatus): Promise<AtcProperty[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyRow[]>(
        `SELECT * FROM atc_properties WHERE status = ? ORDER BY created_at DESC`,
        [status],
      )
      return rows.map(rowToProperty)
    } finally {
      conn.release()
    }
  }

  async listByOwner(ownerId: string): Promise<AtcProperty[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyRow[]>(
        `SELECT * FROM atc_properties WHERE owner_id = ? ORDER BY created_at DESC`,
        [ownerId],
      )
      return rows.map(rowToProperty)
    } finally {
      conn.release()
    }
  }

  async listByOrganization(organizationId: string): Promise<AtcProperty[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<PropertyRow[]>(
        `SELECT * FROM atc_properties WHERE organization_id = ? ORDER BY created_at DESC`,
        [organizationId],
      )
      return rows.map(rowToProperty)
    } finally {
      conn.release()
    }
  }

  private async _findById(
    conn: Awaited<ReturnType<PropertyPool['getConnection']>>,
    propertyId: string,
  ): Promise<AtcProperty | null> {
    const [rows] = await conn.execute<PropertyRow[]>(
      `SELECT * FROM atc_properties WHERE id = ? LIMIT 1`,
      [propertyId],
    )
    return rows[0] ? rowToProperty(rows[0]) : null
  }
}
