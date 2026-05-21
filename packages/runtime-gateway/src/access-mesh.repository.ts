import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { RuntimeGatewayPool } from './pool.js'
import { generateId } from './id.js'
import { AccessMeshNotFoundError } from './errors.js'

export type AtcMeshType = 'overlay' | 'underlay' | 'hybrid' | 'federated' | 'custom'
export type AtcMeshStatus = 'active' | 'synchronized' | 'desynchronized' | 'degraded' | 'offline'

export interface AtcAccessMesh {
  id: string; meshId: string; meshType: AtcMeshType; status: AtcMeshStatus
  ownerServerId: string; meshData: Record<string, unknown>; syncedAt: Date
  createdAt: Date; updatedAt: Date
}

export interface SyncMeshParams {
  meshId: string; meshType: AtcMeshType; ownerServerId: string
  meshData?: Record<string, unknown> | undefined
}

interface MeshRow extends RowDataPacket {
  id: string; mesh_id: string; mesh_type: string; status: string
  owner_server_id: string; mesh_data: string | null; synced_at: Date
  created_at: Date; updated_at: Date
}

function mapRow(row: MeshRow): AtcAccessMesh {
  return {
    id: row.id, meshId: row.mesh_id, meshType: row.mesh_type as AtcMeshType,
    status: row.status as AtcMeshStatus, ownerServerId: row.owner_server_id,
    meshData: row.mesh_data ? (JSON.parse(row.mesh_data) as Record<string, unknown>) : {},
    syncedAt: row.synced_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export class AccessMeshRepository {
  constructor(private readonly pool: RuntimeGatewayPool) {}

  async upsert(params: SyncMeshParams): Promise<AtcAccessMesh> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const meshDataJson = JSON.stringify(params.meshData ?? {})
      await conn.beginTransaction()
      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_access_mesh (id, mesh_id, mesh_type, status, owner_server_id, mesh_data, synced_at, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NOW(3), NOW(3)) ON DUPLICATE KEY UPDATE mesh_type = VALUES(mesh_type), owner_server_id = VALUES(owner_server_id), mesh_data = VALUES(mesh_data), synced_at = NOW(3), updated_at = NOW(3)`,
          [id, params.meshId, params.meshType, params.ownerServerId, meshDataJson] as unknown[]
        )
        const [rows] = await conn.execute<MeshRow[]>(
          `SELECT id, mesh_id, mesh_type, status, owner_server_id, mesh_data, synced_at, created_at, updated_at FROM atc_access_mesh WHERE mesh_id = ? LIMIT 1`,
          [params.meshId]
        )
        if (!rows[0]) throw new Error(`Mesh not found after upsert: ${params.meshId}`)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async findByMeshId(meshId: string): Promise<AtcAccessMesh | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MeshRow[]>(
        `SELECT id, mesh_id, mesh_type, status, owner_server_id, mesh_data, synced_at, created_at, updated_at FROM atc_access_mesh WHERE mesh_id = ? LIMIT 1`,
        [meshId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally { conn.release() }
  }

  async updateStatus(meshId: string, status: AtcMeshStatus): Promise<AtcAccessMesh> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<MeshRow[]>(
          `SELECT id, mesh_id, mesh_type, status, owner_server_id, mesh_data, synced_at, created_at, updated_at FROM atc_access_mesh WHERE mesh_id = ? LIMIT 1 FOR UPDATE`,
          [meshId]
        )
        if (!lockRows[0]) throw new AccessMeshNotFoundError(meshId)
        await conn.execute<ResultSetHeader>(
          `UPDATE atc_access_mesh SET status = ?, updated_at = NOW(3) WHERE mesh_id = ?`,
          [status, meshId] as unknown[]
        )
        const [rows] = await conn.execute<MeshRow[]>(
          `SELECT id, mesh_id, mesh_type, status, owner_server_id, mesh_data, synced_at, created_at, updated_at FROM atc_access_mesh WHERE mesh_id = ? LIMIT 1`,
          [meshId]
        )
        if (!rows[0]) throw new AccessMeshNotFoundError(meshId)
        await conn.commit()
        return mapRow(rows[0])
      } catch (err) { await conn.rollback(); throw err }
    } finally { conn.release() }
  }

  async cleanupStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_access_mesh WHERE status IN ('offline', 'desynchronized') AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally { conn.release() }
  }
}
