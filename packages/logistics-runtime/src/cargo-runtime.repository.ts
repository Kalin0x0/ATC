import type { RowDataPacket } from 'mysql2'
import type { LogisticsRuntimePool } from './pool.js'
import { generateId } from './id.js'

export interface AtcCargoRuntime {
  id: string
  cargoId: string
  shipmentId: string
  itemId: string
  quantity: number
  weight: number
  isContraband: boolean
  createdAt: Date
  updatedAt: Date
}

interface CargoRuntimeRow extends RowDataPacket {
  id: string
  cargo_id: string
  shipment_id: string
  item_id: string
  quantity: number
  weight: number
  is_contraband: number | boolean
  created_at: Date
  updated_at: Date
}

function rowToCargo(row: CargoRuntimeRow): AtcCargoRuntime {
  return {
    id: row.id,
    cargoId: row.cargo_id,
    shipmentId: row.shipment_id,
    itemId: row.item_id,
    quantity: row.quantity,
    weight: row.weight,
    isContraband: Boolean(row.is_contraband),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CargoRuntimeRepository {
  constructor(private readonly pool: LogisticsRuntimePool) {}

  async findByCargoId(cargoId: string): Promise<AtcCargoRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<CargoRuntimeRow[]>(
        'SELECT * FROM atc_cargo_runtime WHERE cargo_id = ? LIMIT 1',
        [cargoId],
      )
      const row = rows[0]
      return row !== undefined ? rowToCargo(row) : null
    } finally {
      conn.release()
    }
  }

  async listByShipment(shipmentId: string): Promise<AtcCargoRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.query<CargoRuntimeRow[]>(
        'SELECT * FROM atc_cargo_runtime WHERE shipment_id = ? ORDER BY created_at ASC',
        [shipmentId],
      )
      return rows.map(rowToCargo)
    } finally {
      conn.release()
    }
  }

  async addCargo(
    shipmentId: string,
    itemId: string,
    quantity: number,
    weight: number,
    isContraband?: boolean,
  ): Promise<AtcCargoRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const contraband = isContraband ?? false
      const binds: (string | number | boolean | null)[] = [
        id,
        shipmentId,
        itemId,
        quantity,
        weight,
        contraband,
      ]
      await conn.query(
        `INSERT INTO atc_cargo_runtime
          (id, cargo_id, shipment_id, item_id, quantity, weight, is_contraband)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        binds,
      )
      const [rows] = await conn.query<CargoRuntimeRow[]>(
        'SELECT * FROM atc_cargo_runtime WHERE id = ? LIMIT 1',
        [id],
      )
      const row = rows[0]
      if (row === undefined) throw new Error(`Cargo not found after insert: ${id}`)
      return rowToCargo(row)
    } finally {
      conn.release()
    }
  }

  async removeCargo(cargoId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.query(
        'DELETE FROM atc_cargo_runtime WHERE cargo_id = ?',
        [cargoId],
      )
    } finally {
      conn.release()
    }
  }
}
