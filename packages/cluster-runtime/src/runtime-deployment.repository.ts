import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ClusterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { DeploymentNotFoundError, DuplicateDeploymentError } from './errors.js'

export type AtcDeploymentType = 'rolling' | 'blue_green' | 'canary' | 'hotfix' | 'full' | 'custom'
export type AtcDeploymentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'

export interface AtcRuntimeDeployment {
  id: string
  deploymentId: string
  deploymentType: AtcDeploymentType
  status: AtcDeploymentStatus
  targetNode: string
  ownerServerId: string
  deploymentNonce: string
  deploymentData: Record<string, unknown>
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateDeploymentParams {
  deploymentType: AtcDeploymentType
  targetNode: string
  ownerServerId: string
  deploymentNonce: string
  deploymentData?: Record<string, unknown> | undefined
}

interface DeploymentRow extends RowDataPacket {
  id: string
  deployment_id: string
  deployment_type: string
  status: string
  target_node: string
  owner_server_id: string
  deployment_nonce: string
  deployment_data: string | null
  started_at: Date
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: DeploymentRow): AtcRuntimeDeployment {
  let deploymentData: Record<string, unknown> = {}
  if (row.deployment_data) {
    try { deploymentData = JSON.parse(row.deployment_data) as Record<string, unknown> } catch { deploymentData = {} }
  }
  return {
    id: row.id,
    deploymentId: row.deployment_id,
    deploymentType: row.deployment_type as AtcDeploymentType,
    status: row.status as AtcDeploymentStatus,
    targetNode: row.target_node,
    ownerServerId: row.owner_server_id,
    deploymentNonce: row.deployment_nonce,
    deploymentData,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeDeploymentRepository {
  constructor(private readonly pool: ClusterRuntimePool) {}

  async create(params: CreateDeploymentParams): Promise<AtcRuntimeDeployment> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const deploymentId = generateId()
      const deploymentDataJson = JSON.stringify(params.deploymentData ?? {})

      try {
        await conn.execute<ResultSetHeader>(
          `INSERT INTO atc_runtime_deployments
             (id, deployment_id, deployment_type, status, target_node, owner_server_id,
              deployment_nonce, deployment_data, started_at, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NOW(3), NULL, NOW(3), NOW(3))`,
          [id, deploymentId, params.deploymentType, params.targetNode, params.ownerServerId,
           params.deploymentNonce, deploymentDataJson] as string[]
        )
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') throw new DuplicateDeploymentError(params.deploymentNonce)
        throw err
      }

      const [rows] = await conn.execute<DeploymentRow[]>(
        `SELECT id, deployment_id, deployment_type, status, target_node, owner_server_id,
                deployment_nonce, deployment_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_deployments WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) throw new Error(`Deployment not found after insert: ${id}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findById(id: string): Promise<AtcRuntimeDeployment | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<DeploymentRow[]>(
        `SELECT id, deployment_id, deployment_type, status, target_node, owner_server_id,
                deployment_nonce, deployment_data, started_at, completed_at, created_at, updated_at
         FROM atc_runtime_deployments WHERE id = ? LIMIT 1`,
        [id]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async updateStatus(
    id: string,
    status: AtcDeploymentStatus,
    completedAt?: Date | undefined
  ): Promise<AtcRuntimeDeployment> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<DeploymentRow[]>(
          `SELECT id, deployment_id, deployment_type, status, target_node, owner_server_id,
                  deployment_nonce, deployment_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_deployments WHERE id = ? LIMIT 1 FOR UPDATE`,
          [id]
        )
        if (!lockRows[0]) throw new DeploymentNotFoundError(id)

        if (completedAt !== undefined) {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_deployments SET status = ?, completed_at = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, completedAt.toISOString().replace('T', ' ').replace('Z', ''), id] as string[]
          )
        } else {
          await conn.execute<ResultSetHeader>(
            `UPDATE atc_runtime_deployments SET status = ?, updated_at = NOW(3) WHERE id = ?`,
            [status, id]
          )
        }

        const [rows] = await conn.execute<DeploymentRow[]>(
          `SELECT id, deployment_id, deployment_type, status, target_node, owner_server_id,
                  deployment_nonce, deployment_data, started_at, completed_at, created_at, updated_at
           FROM atc_runtime_deployments WHERE id = ? LIMIT 1`,
          [id]
        )
        if (!rows[0]) throw new DeploymentNotFoundError(id)
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
        `DELETE FROM atc_runtime_deployments
         WHERE status IN ('completed', 'failed', 'rolled_back')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
