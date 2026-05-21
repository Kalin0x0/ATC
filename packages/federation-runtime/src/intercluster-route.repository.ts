import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { FederationRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { InterclusterRouteNotFoundError, DuplicateInterclusterRouteError } from './errors.js'

export type AtcRouteType = 'direct' | 'relay' | 'failover' | 'broadcast' | 'custom'
export type AtcRouteStatus = 'active' | 'inactive' | 'failed'

export interface AtcInterclusterRoute {
  id: string
  routeId: string
  sourceCluster: string
  targetCluster: string
  routeType: AtcRouteType
  status: AtcRouteStatus
  ownerServerId: string
  routeNonce: string
  routeData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface CreateRouteParams {
  sourceCluster: string
  targetCluster: string
  routeType: AtcRouteType
  ownerServerId: string
  routeNonce: string
  routeData?: Record<string, unknown> | undefined
}

interface InterclusterRouteRow extends RowDataPacket {
  id: string
  route_id: string
  source_cluster: string
  target_cluster: string
  route_type: string
  status: string
  owner_server_id: string
  route_nonce: string
  route_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: InterclusterRouteRow): AtcInterclusterRoute {
  let routeData: Record<string, unknown> = {}
  if (row.route_data) {
    try { routeData = JSON.parse(row.route_data) as Record<string, unknown> } catch { routeData = {} }
  }
  return {
    id: row.id,
    routeId: row.route_id,
    sourceCluster: row.source_cluster,
    targetCluster: row.target_cluster,
    routeType: row.route_type as AtcRouteType,
    status: row.status as AtcRouteStatus,
    ownerServerId: row.owner_server_id,
    routeNonce: row.route_nonce,
    routeData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class InterclusterRouteRepository {
  constructor(private readonly pool: FederationRuntimePool) {}

  async create(params: CreateRouteParams): Promise<AtcInterclusterRoute> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const routeId = generateId()
      const routeDataJson = JSON.stringify(params.routeData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_intercluster_routes
             (id, route_id, source_cluster, target_cluster, route_type, status, owner_server_id,
              route_nonce, route_data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, NOW(3), NOW(3))`,
          [id, routeId, params.sourceCluster, params.targetCluster, params.routeType,
           params.ownerServerId, params.routeNonce, routeDataJson] as string[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateInterclusterRouteError(params.routeNonce)
        throw err
      }

      const [rows] = await conn.execute<InterclusterRouteRow[]>(
        `SELECT id, route_id, source_cluster, target_cluster, route_type, status, owner_server_id,
                route_nonce, route_data, created_at, updated_at
         FROM atc_intercluster_routes WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Intercluster route not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcInterclusterRoute | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<InterclusterRouteRow[]>(
        `SELECT id, route_id, source_cluster, target_cluster, route_type, status, owner_server_id,
                route_nonce, route_data, created_at, updated_at
         FROM atc_intercluster_routes WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(id: string, status: AtcRouteStatus): Promise<AtcInterclusterRoute> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<InterclusterRouteRow[]>(
          `SELECT id, route_id, source_cluster, target_cluster, route_type, status, owner_server_id,
                  route_nonce, route_data, created_at, updated_at
           FROM atc_intercluster_routes WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new InterclusterRouteNotFoundError(id)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_intercluster_routes SET status = ?, updated_at = NOW(3) WHERE id = ?`,
          [status, id]
        )

        const [rows] = await conn.execute<InterclusterRouteRow[]>(
          `SELECT id, route_id, source_cluster, target_cluster, route_type, status, owner_server_id,
                  route_nonce, route_data, created_at, updated_at
           FROM atc_intercluster_routes WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new InterclusterRouteNotFoundError(id)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_intercluster_routes
         WHERE status IN ('inactive', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
