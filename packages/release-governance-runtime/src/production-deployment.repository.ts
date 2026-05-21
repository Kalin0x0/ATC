import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReleaseGovernancePool } from './pool.js'
import { generateId } from './id.js'
import { ProductionDeploymentNotFoundError } from './errors.js'

export type AtcDeploymentType = 'canary' | 'blue_green' | 'rolling' | 'immediate' | 'custom'
export type AtcDeploymentStatus = 'active' | 'deploying' | 'deployed' | 'rolled_back' | 'failed'

export interface AtcProductionDeployment {
  id: string
  deploymentId: string
  deploymentType: AtcDeploymentType
  status: AtcDeploymentStatus
  ownerServerId: string
  deploymentData: Record<string, unknown>
  syncedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InitiateDeploymentParams {
  deploymentId: string
  deploymentType: AtcDeploymentType
  ownerServerId: string
  deploymentData?: Record<string, unknown> | undefined
}

interface ProductionDeploymentRow extends RowDataPacket {
  id: string
  deployment_id: string
  deployment_type: string
  status: string
  owner_server_id: string
  deployment_data: string | null
  synced_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: ProductionDeploymentRow): AtcProductionDeployment {
  let deploymentData: Record<string, unknown> = {}
  if (row.deployment_data) {
    try {
      deploymentData = JSON.parse(row.deployment_data) as Record<string, unknown>
    } catch {
      deploymentData = {}
    }
  }
  return {
    id: row.id,
    deploymentId: row.deployment_id,
    deploymentType: row.deployment_type as AtcDeploymentType,
    status: row.status as AtcDeploymentStatus,
    ownerServerId: row.owner_server_id,
    deploymentData,
    syncedAt: row.synced_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProductionDeploymentRepository {
  constructor(private readonly pool: ReleaseGovernancePool) {}

  async upsert(params: InitiateDeploymentParams): Promise<AtcProductionDeployment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const deploymentDataJson = JSON.stringify(params.deploymentData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_production_deployments
           (id, deployment_id, deployment_type, status, owner_server_id,
            deployment_data, synced_at, completed_at, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, NOW(3), NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           deployment_type = VALUES(deployment_type),
           status = VALUES(status),
           owner_server_id = VALUES(owner_server_id),
           deployment_data = VALUES(deployment_data),
           synced_at = NOW(3),
           updated_at = NOW(3)`,
        [
          id,
          params.deploymentId,
          params.deploymentType,
          params.ownerServerId,
          deploymentDataJson,
        ] as unknown[]
      )

      const [rows] = await conn.execute<ProductionDeploymentRow[]>(
        `SELECT id, deployment_id, deployment_type, status, owner_server_id,
                deployment_data, synced_at, completed_at, created_at, updated_at
         FROM atc_production_deployments
         WHERE deployment_id = ?
         LIMIT 1`,
        [params.deploymentId] as unknown[]
      )
      if (!rows[0]) throw new Error(`Production deployment not found after upsert: ${params.deploymentId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByDeploymentId(deploymentId: string): Promise<AtcProductionDeployment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<ProductionDeploymentRow[]>(
        `SELECT id, deployment_id, deployment_type, status, owner_server_id,
                deployment_data, synced_at, completed_at, created_at, updated_at
         FROM atc_production_deployments
         WHERE deployment_id = ?
         LIMIT 1`,
        [deploymentId] as unknown[]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    deploymentId: string,
    status: AtcDeploymentStatus,
    completedAt?: Date | undefined
  ): Promise<AtcProductionDeployment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<ProductionDeploymentRow[]>(
          `SELECT id, deployment_id, deployment_type, status, owner_server_id,
                  deployment_data, synced_at, completed_at, created_at, updated_at
           FROM atc_production_deployments
           WHERE deployment_id = ?
           LIMIT 1
           FOR UPDATE`,
          [deploymentId] as unknown[]
        )
        if (!lockRows[0]) throw new ProductionDeploymentNotFoundError(deploymentId)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_deployments
             SET status = ?, completed_at = ?, updated_at = NOW(3)
             WHERE deployment_id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), deploymentId] as unknown[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_production_deployments
             SET status = ?, updated_at = NOW(3)
             WHERE deployment_id = ?`,
            [status, deploymentId] as unknown[]
          )
        }

        const [rows] = await conn.execute<ProductionDeploymentRow[]>(
          `SELECT id, deployment_id, deployment_type, status, owner_server_id,
                  deployment_data, synced_at, completed_at, created_at, updated_at
           FROM atc_production_deployments
           WHERE deployment_id = ?
           LIMIT 1`,
          [deploymentId] as unknown[]
        )
        if (!rows[0]) throw new ProductionDeploymentNotFoundError(deploymentId)

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
        `DELETE FROM atc_production_deployments
         WHERE status IN ('rolled_back', 'failed')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs] as unknown[]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
