import type { RowDataPacket } from 'mysql2/promise'
import type { TransportRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { AirspaceZoneNotFoundError } from './errors.js'

export type AtcAirspaceStatus = 'open' | 'restricted' | 'closed' | 'emergency'

export interface AtcAirspaceZone {
  id: string
  zoneId: string
  zoneName: string
  zoneType: string
  minAltitudeM: number
  maxAltitudeM: number
  status: AtcAirspaceStatus
  ownerServerId: string | null
  createdAt: Date
  updatedAt: Date
}

interface AirspaceZoneRow extends RowDataPacket {
  id: string
  zone_id: string
  zone_name: string
  zone_type: string
  min_altitude_m: number
  max_altitude_m: number
  status: string
  owner_server_id: string | null
  created_at: Date
  updated_at: Date
}

function rowToZone(row: AirspaceZoneRow): AtcAirspaceZone {
  return {
    id: row.id,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    zoneType: row.zone_type,
    minAltitudeM: row.min_altitude_m,
    maxAltitudeM: row.max_altitude_m,
    status: row.status as AtcAirspaceStatus,
    ownerServerId: row.owner_server_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class AirspaceZoneRepository {
  constructor(private readonly pool: TransportRuntimePool) {}

  async findById(zoneId: string): Promise<AtcAirspaceZone | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AirspaceZoneRow[]>(
        'SELECT * FROM `atc_airspace_zones` WHERE `zone_id` = ? LIMIT 1',
        [zoneId],
      )
      return rows[0] ? rowToZone(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcAirspaceZone[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AirspaceZoneRow[]>(
        'SELECT * FROM `atc_airspace_zones` ORDER BY `created_at` ASC',
      )
      return rows.map(rowToZone)
    } finally {
      conn.release()
    }
  }

  async upsert(params: {
    zoneId: string
    zoneName: string
    zoneType: string
    minAltitudeM: number
    maxAltitudeM: number
    ownerServerId?: string
  }): Promise<AtcAirspaceZone> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const ownerBind: string | null = params.ownerServerId !== undefined
        ? params.ownerServerId
        : null
      const binds: (string | number | boolean | null)[] = [
        id,
        params.zoneId,
        params.zoneName,
        params.zoneType,
        params.minAltitudeM,
        params.maxAltitudeM,
        ownerBind,
        params.zoneName,
        params.zoneType,
        params.minAltitudeM,
        params.maxAltitudeM,
        ownerBind,
      ]
      await conn.execute(
        `INSERT INTO \`atc_airspace_zones\`
           (\`id\`, \`zone_id\`, \`zone_name\`, \`zone_type\`,
            \`min_altitude_m\`, \`max_altitude_m\`, \`owner_server_id\`,
            \`status\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           \`zone_name\` = ?,
           \`zone_type\` = ?,
           \`min_altitude_m\` = ?,
           \`max_altitude_m\` = ?,
           \`owner_server_id\` = ?,
           \`updated_at\` = NOW(3)`,
        binds,
      )
      const zone = await this.findById(params.zoneId)
      if (zone === null) throw new AirspaceZoneNotFoundError(params.zoneId)
      return zone
    } finally {
      conn.release()
    }
  }

  async updateStatus(zoneId: string, status: AtcAirspaceStatus): Promise<AtcAirspaceZone> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [rows] = await conn.execute<AirspaceZoneRow[]>(
          'SELECT * FROM `atc_airspace_zones` WHERE `zone_id` = ? FOR UPDATE',
          [zoneId],
        )
        if (!rows[0]) throw new AirspaceZoneNotFoundError(zoneId)
        await conn.execute(
          'UPDATE `atc_airspace_zones` SET `status` = ?, `updated_at` = NOW(3) WHERE `zone_id` = ?',
          [status, zoneId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
    const zone = await this.findById(zoneId)
    if (zone === null) throw new AirspaceZoneNotFoundError(zoneId)
    return zone
  }
}
