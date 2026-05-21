import type { RowDataPacket } from 'mysql2/promise'
import type { TransportRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DuplicateDockingNonceError } from './errors.js'

export type AtcDockStatus = 'available' | 'occupied' | 'reserved' | 'maintenance'

export interface AtcDockingRuntime {
  id: string
  dockingId: string
  dockingNonce: string
  vesselId: string
  dockZoneId: string
  slotId: string | null
  status: AtcDockStatus
  dockedAt: Date | null
  undockedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface DockingRow extends RowDataPacket {
  id: string
  docking_id: string
  docking_nonce: string
  vessel_id: string
  dock_zone_id: string
  slot_id: string | null
  status: string
  docked_at: Date | null
  undocked_at: Date | null
  created_at: Date
  updated_at: Date
}

function isMysqlDupEntryError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'ER_DUP_ENTRY'
  )
}

function rowToDocking(row: DockingRow): AtcDockingRuntime {
  return {
    id: row.id,
    dockingId: row.docking_id,
    dockingNonce: row.docking_nonce,
    vesselId: row.vessel_id,
    dockZoneId: row.dock_zone_id,
    slotId: row.slot_id,
    status: row.status as AtcDockStatus,
    dockedAt: row.docked_at,
    undockedAt: row.undocked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class DockingRuntimeRepository {
  constructor(private readonly pool: TransportRuntimePool) {}

  async findById(dockingId: string): Promise<AtcDockingRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DockingRow[]>(
        'SELECT * FROM `atc_docking_runtime` WHERE `docking_id` = ? LIMIT 1',
        [dockingId],
      )
      return rows[0] ? rowToDocking(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async findByVessel(vesselId: string): Promise<AtcDockingRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DockingRow[]>(
        'SELECT * FROM `atc_docking_runtime` WHERE `vessel_id` = ? ORDER BY `created_at` DESC LIMIT 1',
        [vesselId],
      )
      return rows[0] ? rowToDocking(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listActiveByZone(zoneId: string): Promise<AtcDockingRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DockingRow[]>(
        "SELECT * FROM `atc_docking_runtime` WHERE `dock_zone_id` = ? AND `status` IN ('occupied', 'reserved') ORDER BY `created_at` ASC",
        [zoneId],
      )
      return rows.map(rowToDocking)
    } finally {
      conn.release()
    }
  }

  async create(params: {
    dockingNonce: string
    vesselId: string
    dockZoneId: string
    slotId?: string
  }): Promise<AtcDockingRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const dockingId = generateId()
      const slotBind: string | null = params.slotId !== undefined ? params.slotId : null
      const binds: (string | number | boolean | null)[] = [
        id,
        dockingId,
        params.dockingNonce,
        params.vesselId,
        params.dockZoneId,
        slotBind,
      ]
      try {
        await conn.execute(
          `INSERT INTO \`atc_docking_runtime\`
             (\`id\`, \`docking_id\`, \`docking_nonce\`, \`vessel_id\`,
              \`dock_zone_id\`, \`slot_id\`, \`status\`, \`docked_at\`,
              \`created_at\`, \`updated_at\`)
           VALUES (?, ?, ?, ?, ?, ?, 'occupied', NOW(3), NOW(3), NOW(3))`,
          binds,
        )
      } catch (err) {
        if (isMysqlDupEntryError(err)) {
          throw new DuplicateDockingNonceError(params.dockingNonce)
        }
        throw err
      }
      const docking = await this.findById(dockingId)
      if (docking === null) {
        throw new Error(`Docking record not found after insert: ${dockingId}`)
      }
      return docking
    } finally {
      conn.release()
    }
  }

  async updateStatus(dockingId: string, status: AtcDockStatus): Promise<AtcDockingRuntime> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<DockingRow[]>(
          'SELECT * FROM `atc_docking_runtime` WHERE `docking_id` = ? FOR UPDATE',
          [dockingId],
        )
        if (!rows[0]) throw new Error(`Docking record not found: ${dockingId}`)

        const setParts: string[] = ['`status` = ?', '`updated_at` = NOW(3)']
        const binds: (string | number | boolean | null)[] = [status]

        if (status === 'available') {
          setParts.push('`undocked_at` = NOW(3)')
        }

        binds.push(dockingId)
        await conn.execute(
          `UPDATE \`atc_docking_runtime\` SET ${setParts.join(', ')} WHERE \`docking_id\` = ?`,
          binds,
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
    const docking = await this.findById(dockingId)
    if (docking === null) {
      throw new Error(`Docking record not found after update: ${dockingId}`)
    }
    return docking
  }
}
