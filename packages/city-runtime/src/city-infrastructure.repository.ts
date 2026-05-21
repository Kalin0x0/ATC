import type { RowDataPacket } from 'mysql2/promise'
import type { CityRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { InfrastructureNotFoundError } from './errors.js'

export type AtcInfrastructureType =
  | 'power_station'
  | 'water_treatment'
  | 'gas_main'
  | 'telecom_hub'
  | 'road_segment'
  | 'bridge'
  | 'tunnel'
  | 'sewage'
  | 'other'

export type AtcInfrastructureStatus =
  | 'operational'
  | 'degraded'
  | 'offline'
  | 'maintenance'
  | 'destroyed'

export interface AtcCityInfrastructure {
  id: string
  nodeId: string
  nodeName: string
  infrastructureType: AtcInfrastructureType
  status: AtcInfrastructureStatus
  ownerServerId: string | null
  positionX: number | null
  positionY: number | null
  positionZ: number | null
  healthPercent: number
  lastTickAt: Date
  createdAt: Date
  updatedAt: Date
}

interface InfrastructureRow extends RowDataPacket {
  id: string
  node_id: string
  node_name: string
  infrastructure_type: string
  status: string
  owner_server_id: string | null
  position_x: number | null
  position_y: number | null
  position_z: number | null
  health_percent: number
  last_tick_at: Date
  created_at: Date
  updated_at: Date
}

function rowToInfrastructure(row: InfrastructureRow): AtcCityInfrastructure {
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeName: row.node_name,
    infrastructureType: row.infrastructure_type as AtcInfrastructureType,
    status: row.status as AtcInfrastructureStatus,
    ownerServerId: row.owner_server_id,
    positionX: row.position_x !== null ? Number(row.position_x) : null,
    positionY: row.position_y !== null ? Number(row.position_y) : null,
    positionZ: row.position_z !== null ? Number(row.position_z) : null,
    healthPercent: Number(row.health_percent),
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CityInfrastructureRepository {
  constructor(private readonly pool: CityRuntimePool) {}

  async findByNodeId(nodeId: string): Promise<AtcCityInfrastructure | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      return rows[0] ? rowToInfrastructure(rows[0]) : null
    } finally {
      conn.release()
    }
  }

  async upsert(
    nodeId: string,
    nodeName: string,
    type: AtcInfrastructureType,
    status: AtcInfrastructureStatus,
    health: number,
  ): Promise<AtcCityInfrastructure> {
    const id = generateId()
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `INSERT INTO atc_city_infrastructure
           (id, node_id, node_name, infrastructure_type, status, health_percent, last_tick_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           node_name           = VALUES(node_name),
           infrastructure_type = VALUES(infrastructure_type),
           status              = VALUES(status),
           health_percent      = VALUES(health_percent),
           last_tick_at        = NOW(3),
           updated_at          = NOW(3)`,
        [id, nodeId, nodeName, type, status, health],
      )
      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      if (!rows[0]) throw new InfrastructureNotFoundError(nodeId)
      return rowToInfrastructure(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    nodeId: string,
    status: AtcInfrastructureStatus,
    health?: number | undefined,
  ): Promise<AtcCityInfrastructure> {
    const conn = await this.pool.getConnection()
    try {
      if (health !== undefined) {
        await conn.execute(
          `UPDATE atc_city_infrastructure
           SET status = ?, health_percent = ?, last_tick_at = NOW(3), updated_at = NOW(3)
           WHERE node_id = ?`,
          [status, health, nodeId],
        )
      } else {
        await conn.execute(
          `UPDATE atc_city_infrastructure
           SET status = ?, last_tick_at = NOW(3), updated_at = NOW(3)
           WHERE node_id = ?`,
          [status, nodeId],
        )
      }
      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      if (!rows[0]) throw new InfrastructureNotFoundError(nodeId)
      return rowToInfrastructure(rows[0])
    } finally {
      conn.release()
    }
  }

  async claimOwnership(nodeId: string, ownerServerId: string): Promise<AtcCityInfrastructure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<InfrastructureRow[]>(
          `SELECT * FROM atc_city_infrastructure WHERE node_id = ? LIMIT 1 FOR UPDATE`,
          [nodeId],
        )
        if (!lockRows[0]) throw new InfrastructureNotFoundError(nodeId)

        await conn.execute(
          `UPDATE atc_city_infrastructure
           SET owner_server_id = ?, updated_at = NOW(3)
           WHERE node_id = ?`,
          [ownerServerId, nodeId],
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }

      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      if (!rows[0]) throw new InfrastructureNotFoundError(nodeId)
      return rowToInfrastructure(rows[0])
    } finally {
      conn.release()
    }
  }

  async releaseOwnership(nodeId: string): Promise<AtcCityInfrastructure> {
    const conn = await this.pool.getConnection()
    try {
      await conn.execute(
        `UPDATE atc_city_infrastructure
         SET owner_server_id = NULL, updated_at = NOW(3)
         WHERE node_id = ?`,
        [nodeId],
      )
      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure WHERE node_id = ? LIMIT 1`,
        [nodeId],
      )
      if (!rows[0]) throw new InfrastructureNotFoundError(nodeId)
      return rowToInfrastructure(rows[0])
    } finally {
      conn.release()
    }
  }

  async listDegraded(): Promise<AtcCityInfrastructure[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure
         WHERE status IN ('degraded', 'offline', 'destroyed')
         ORDER BY health_percent ASC`,
      )
      return rows.map(rowToInfrastructure)
    } finally {
      conn.release()
    }
  }

  async listAll(): Promise<AtcCityInfrastructure[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InfrastructureRow[]>(
        `SELECT * FROM atc_city_infrastructure ORDER BY node_name ASC`,
      )
      return rows.map(rowToInfrastructure)
    } finally {
      conn.release()
    }
  }
}
