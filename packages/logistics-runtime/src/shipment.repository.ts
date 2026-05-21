import type { RowDataPacket } from 'mysql2'
import type { LogisticsRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateShipmentNonceError, ShipmentNotFoundError } from './errors.js'

export type AtcShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled'

export interface AtcShipment {
  id: string
  shipmentId: string
  shipmentNonce: string
  originId: string
  destinationId: string
  carrierPrincipalId: string | null
  status: AtcShipmentStatus
  cargoManifest: string[]
  departedAt: Date | null
  arrivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface ShipmentRow extends RowDataPacket {
  id: string
  shipment_id: string
  shipment_nonce: string
  origin_id: string
  destination_id: string
  carrier_principal_id: string | null
  status: AtcShipmentStatus
  cargo_manifest: string
  departed_at: Date | null
  arrived_at: Date | null
  created_at: Date
  updated_at: Date
}

function rowToShipment(row: ShipmentRow): AtcShipment {
  return {
    id: row.id,
    shipmentId: row.shipment_id,
    shipmentNonce: row.shipment_nonce,
    originId: row.origin_id,
    destinationId: row.destination_id,
    carrierPrincipalId: row.carrier_principal_id,
    status: row.status,
    cargoManifest: JSON.parse(row.cargo_manifest) as string[],
    departedAt: row.departed_at,
    arrivedAt: row.arrived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ShipmentRepository {
  constructor(private readonly pool: LogisticsRuntimePool) {}

  async findById(shipmentId: string): Promise<AtcShipment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<ShipmentRow[]>(
        'SELECT * FROM atc_shipments WHERE shipment_id = ? LIMIT 1',
        [shipmentId],
      )
      const row = rows[0]
      return row !== undefined ? rowToShipment(row) : null
    } finally {
      conn.release()
    }
  }

  async findByNonce(nonce: string): Promise<AtcShipment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<ShipmentRow[]>(
        'SELECT * FROM atc_shipments WHERE shipment_nonce = ? LIMIT 1',
        [nonce],
      )
      const row = rows[0]
      return row !== undefined ? rowToShipment(row) : null
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcShipment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<ShipmentRow[]>(
        "SELECT * FROM atc_shipments WHERE status IN ('pending', 'in_transit') ORDER BY created_at ASC",
      )
      return rows.map(rowToShipment)
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcShipment[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<ShipmentRow[]>(
        'SELECT * FROM atc_shipments ORDER BY created_at ASC',
      )
      return rows.map(rowToShipment)
    } finally {
      conn.release()
    }
  }

  async create(params: {
    shipmentNonce: string
    originId: string
    destinationId: string
    carrierPrincipalId?: string
    cargoManifest?: string[]
  }): Promise<AtcShipment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const cargoManifest = JSON.stringify(params.cargoManifest ?? [])
      const binds: (string | number | boolean | null)[] = [
        id,
        params.shipmentNonce,
        params.originId,
        params.destinationId,
        params.carrierPrincipalId ?? null,
        cargoManifest,
      ]
      await conn.query(
        `INSERT INTO atc_shipments
          (id, shipment_id, shipment_nonce, origin_id, destination_id, carrier_principal_id, status, cargo_manifest, departed_at, arrived_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL)`,
        binds,
      )
      const [rows] = await conn.query<ShipmentRow[]>(
        'SELECT * FROM atc_shipments WHERE id = ? LIMIT 1',
        [id],
      )
      const row = rows[0]
      if (row === undefined) throw new ShipmentNotFoundError(params.shipmentNonce)
      return rowToShipment(row)
    } catch (err) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new DuplicateShipmentNonceError(params.shipmentNonce)
      }
      throw err
    } finally {
      conn.release()
    }
  }

  async transition(shipmentId: string, status: AtcShipmentStatus): Promise<AtcShipment> {
    const conn = await this.pool.getConnection()
    let committed = false
    try {
      await conn.beginTransaction()
      const [rows] = await conn.query<ShipmentRow[]>(
        'SELECT * FROM atc_shipments WHERE shipment_id = ? LIMIT 1 FOR UPDATE',
        [shipmentId],
      )
      const row = rows[0]
      if (row === undefined) {
        throw new ShipmentNotFoundError(shipmentId)
      }

      const timestampFields: string[] = []
      const binds: (string | number | boolean | null)[] = [status]

      if (status === 'in_transit') {
        timestampFields.push(', departed_at = NOW(3)')
      } else if (status === 'delivered' || status === 'failed') {
        timestampFields.push(', arrived_at = NOW(3)')
      }

      await conn.query(
        `UPDATE atc_shipments SET status = ?${timestampFields.join('')}, updated_at = NOW(3) WHERE shipment_id = ?`,
        [...binds, shipmentId],
      )
      await conn.commit()
      committed = true

      const [updated] = await conn.query<ShipmentRow[]>(
        'SELECT * FROM atc_shipments WHERE shipment_id = ? LIMIT 1',
        [shipmentId],
      )
      const updatedRow = updated[0]
      if (updatedRow === undefined) throw new ShipmentNotFoundError(shipmentId)
      return rowToShipment(updatedRow)
    } catch (err) {
      if (!committed) await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }
}
