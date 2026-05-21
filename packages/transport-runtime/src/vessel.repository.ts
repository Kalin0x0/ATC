import type { RowDataPacket } from 'mysql2/promise'
import type { TransportRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { VesselNotFoundError } from './errors.js'

export type AtcVesselStatus =
  | 'docked'
  | 'underway'
  | 'anchored'
  | 'maintenance'
  | 'decommissioned'

export interface AtcVessel {
  id: string
  vesselId: string
  vesselName: string
  vesselType: string
  ownedByPrincipalId: string | null
  status: AtcVesselStatus
  positionX: number | null
  positionY: number | null
  positionZ: number | null
  heading: number | null
  speedKnots: number | null
  currentZoneId: string | null
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface VesselRow extends RowDataPacket {
  id: string
  vessel_id: string
  vessel_name: string
  vessel_type: string
  owned_by_principal_id: string | null
  status: string
  position_x: number | null
  position_y: number | null
  position_z: number | null
  heading: number | null
  speed_knots: number | null
  current_zone_id: string | null
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToVessel(row: VesselRow): AtcVessel {
  return {
    id: row.id,
    vesselId: row.vessel_id,
    vesselName: row.vessel_name,
    vesselType: row.vessel_type,
    ownedByPrincipalId: row.owned_by_principal_id,
    status: row.status as AtcVesselStatus,
    positionX: row.position_x,
    positionY: row.position_y,
    positionZ: row.position_z,
    heading: row.heading,
    speedKnots: row.speed_knots,
    currentZoneId: row.current_zone_id,
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class VesselRepository {
  constructor(private readonly pool: TransportRuntimePool) {}

  async findById(vesselId: string): Promise<AtcVessel | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VesselRow[]>(
        'SELECT * FROM `atc_vessels` WHERE `vessel_id` = ? LIMIT 1',
        [vesselId],
      )
      return rows[0] ? rowToVessel(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcVessel[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VesselRow[]>(
        'SELECT * FROM `atc_vessels` ORDER BY `created_at` ASC',
      )
      return rows.map(rowToVessel)
    } finally {
      conn.release()
    }
  }

  async listByStatus(status: AtcVesselStatus): Promise<AtcVessel[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<VesselRow[]>(
        'SELECT * FROM `atc_vessels` WHERE `status` = ? ORDER BY `created_at` ASC',
        [status],
      )
      return rows.map(rowToVessel)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    vesselId: string
    vesselName: string
    vesselType: string
    ownedByPrincipalId?: string
  }): Promise<AtcVessel> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const ownerBind: string | null = params.ownedByPrincipalId !== undefined
        ? params.ownedByPrincipalId
        : null
      const binds: (string | number | boolean | null)[] = [
        id,
        params.vesselId,
        params.vesselName,
        params.vesselType,
        ownerBind,
        params.vesselName,
        params.vesselType,
        ownerBind,
      ]
      await conn.execute(
        `INSERT INTO \`atc_vessels\`
           (\`id\`, \`vessel_id\`, \`vessel_name\`, \`vessel_type\`, \`owned_by_principal_id\`,
            \`status\`, \`last_tick_at\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, 'docked', NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           \`vessel_name\` = ?,
           \`vessel_type\` = ?,
           \`owned_by_principal_id\` = ?,
           \`updated_at\` = NOW(3)`,
        binds,
      )
      const vessel = await this.findById(params.vesselId)
      if (vessel === null) throw new VesselNotFoundError(params.vesselId)
      return vessel
    } finally {
      conn.release()
    }
  }

  async updateStatus(vesselId: string, status: AtcVesselStatus): Promise<AtcVessel> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<VesselRow[]>(
          'SELECT * FROM `atc_vessels` WHERE `vessel_id` = ? FOR UPDATE',
          [vesselId],
        )
        if (!rows[0]) throw new VesselNotFoundError(vesselId)
        await conn.execute(
          'UPDATE `atc_vessels` SET `status` = ?, `updated_at` = NOW(3) WHERE `vessel_id` = ?',
          [status, vesselId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
    const vessel = await this.findById(vesselId)
    if (vessel === null) throw new VesselNotFoundError(vesselId)
    return vessel
  }

  async updatePosition(
    vesselId: string,
    params: {
      positionX: number
      positionY: number
      positionZ?: number
      heading?: number
      speedKnots?: number
      zoneId?: string
    },
  ): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      const setParts: string[] = [
        '`position_x` = ?',
        '`position_y` = ?',
        '`last_tick_at` = NOW(3)',
        '`updated_at` = NOW(3)',
      ]
      const binds: (string | number | boolean | null)[] = [params.positionX, params.positionY]

      if (params.positionZ !== undefined) {
        setParts.push('`position_z` = ?')
        binds.push(params.positionZ)
      }
      if (params.heading !== undefined) {
        setParts.push('`heading` = ?')
        binds.push(params.heading)
      }
      if (params.speedKnots !== undefined) {
        setParts.push('`speed_knots` = ?')
        binds.push(params.speedKnots)
      }
      if (params.zoneId !== undefined) {
        setParts.push('`current_zone_id` = ?')
        binds.push(params.zoneId)
      }

      binds.push(vesselId)
      await conn.execute(
        `UPDATE \`atc_vessels\` SET ${setParts.join(', ')} WHERE \`vessel_id\` = ?`,
        binds,
      )
    } finally {
      conn.release()
    }
  }
}
