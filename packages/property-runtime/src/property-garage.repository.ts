import type { RowDataPacket } from 'mysql2/promise'
import type { AtcPropertyGarage } from '@atc/shared-types'
import type { PropertyPool } from './pool.js'
import { generateId } from './id.js'
import { PropertyGarageNotFoundError, PropertyGarageAlreadyLinkedError } from './errors.js'

interface GarageRow extends RowDataPacket {
  id: string
  property_id: string
  garage_id: string
  label: string
  capacity: number
  linked_by_principal_id: string
  linked_at: Date
  unlinked_at: Date | null
  unlinked_by_principal_id: string | null
}

function rowToGarage(row: GarageRow): AtcPropertyGarage {
  return {
    id: row.id,
    propertyId: row.property_id,
    garageId: row.garage_id,
    label: row.label,
    capacity: row.capacity,
    linkedByPrincipalId: row.linked_by_principal_id,
    linkedAt: row.linked_at,
    unlinkedAt: row.unlinked_at,
    unlinkedByPrincipalId: row.unlinked_by_principal_id,
  }
}

export class PropertyGarageRepository {
  constructor(private readonly pool: PropertyPool) {}

  async link(
    propertyId: string,
    garageId: string,
    linkedByPrincipalId: string,
    label?: string,
    capacity?: number,
  ): Promise<AtcPropertyGarage> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [existing] = await conn.execute<GarageRow[]>(
          `SELECT id FROM atc_property_garages
           WHERE property_id = ? AND garage_id = ? AND unlinked_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [propertyId, garageId],
        )
        if (existing.length > 0) {
          throw new PropertyGarageAlreadyLinkedError(propertyId, garageId)
        }

        await conn.execute(
          `INSERT INTO atc_property_garages
             (id, property_id, garage_id, label, capacity, linked_by_principal_id, linked_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(3))`,
          [id, propertyId, garageId, label ?? '', capacity ?? 4, linkedByPrincipalId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<GarageRow[]>(
        `SELECT * FROM atc_property_garages WHERE id = ? LIMIT 1`,
        [id],
      )
      if (!rows[0]) throw new PropertyGarageNotFoundError(propertyId, garageId)
      return rowToGarage(rows[0])
    } finally {
      conn.release()
    }
  }

  async unlink(
    propertyId: string,
    garageId: string,
    unlinkedByPrincipalId: string,
  ): Promise<AtcPropertyGarage> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<GarageRow[]>(
          `SELECT * FROM atc_property_garages
           WHERE property_id = ? AND garage_id = ? AND unlinked_at IS NULL
           LIMIT 1 FOR UPDATE`,
          [propertyId, garageId],
        )
        if (!rows[0]) throw new PropertyGarageNotFoundError(propertyId, garageId)

        await conn.execute(
          `UPDATE atc_property_garages
           SET unlinked_at = NOW(3), unlinked_by_principal_id = ?
           WHERE id = ?`,
          [unlinkedByPrincipalId, rows[0].id],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<GarageRow[]>(
        `SELECT * FROM atc_property_garages
         WHERE property_id = ? AND garage_id = ?
         ORDER BY linked_at DESC LIMIT 1`,
        [propertyId, garageId],
      )
      if (!rows[0]) throw new PropertyGarageNotFoundError(propertyId, garageId)
      return rowToGarage(rows[0])
    } finally {
      conn.release()
    }
  }

  async findActive(propertyId: string, garageId: string): Promise<AtcPropertyGarage | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GarageRow[]>(
        `SELECT * FROM atc_property_garages
         WHERE property_id = ? AND garage_id = ? AND unlinked_at IS NULL
         LIMIT 1`,
        [propertyId, garageId],
      )
      return rows[0] ? rowToGarage(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActiveForProperty(propertyId: string): Promise<AtcPropertyGarage[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<GarageRow[]>(
        `SELECT * FROM atc_property_garages
         WHERE property_id = ? AND unlinked_at IS NULL
         ORDER BY linked_at ASC`,
        [propertyId],
      )
      return rows.map(rowToGarage)
    } finally {
      conn.release()
    }
  }
}
