import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ClusterRuntimePool } from './pool.js'
import { generateId } from './id.js'
import { AllocationNotFoundError } from './errors.js'

export type AtcAllocationStatus = 'active' | 'released' | 'evicted'

export interface AtcRuntimeAllocation {
  id: string
  allocationId: string
  entityId: string
  nodeId: string
  status: AtcAllocationStatus
  ownerServerId: string
  allocationData: Record<string, unknown>
  allocatedAt: Date
  releasedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAllocationParams {
  entityId: string
  nodeId: string
  ownerServerId: string
  allocationData?: Record<string, unknown> | undefined
}

interface AllocationRow extends RowDataPacket {
  id: string
  allocation_id: string
  entity_id: string
  node_id: string
  status: string
  owner_server_id: string
  allocation_data: string | null
  allocated_at: Date
  released_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AllocationRow): AtcRuntimeAllocation {
  let allocationData: Record<string, unknown> = {}
  if (row.allocation_data) {
    try { allocationData = JSON.parse(row.allocation_data) as Record<string, unknown> } catch { allocationData = {} }
  }
  return {
    id: row.id,
    allocationId: row.allocation_id,
    entityId: row.entity_id,
    nodeId: row.node_id,
    status: row.status as AtcAllocationStatus,
    ownerServerId: row.owner_server_id,
    allocationData,
    allocatedAt: row.allocated_at,
    releasedAt: row.released_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeAllocationRepository {
  constructor(private readonly pool: ClusterRuntimePool) {}

  async upsert(params: CreateAllocationParams): Promise<AtcRuntimeAllocation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const allocationId = generateId()
      const allocationDataJson = JSON.stringify(params.allocationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_runtime_allocation
           (id, allocation_id, entity_id, node_id, status, owner_server_id,
            allocation_data, allocated_at, released_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?, NOW(3), NULL, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           allocation_id = VALUES(allocation_id),
           node_id = VALUES(node_id),
           status = 'active',
           owner_server_id = VALUES(owner_server_id),
           allocation_data = VALUES(allocation_data),
           allocated_at = NOW(3),
           released_at = NULL,
           updated_at = NOW(3)`,
        [id, allocationId, params.entityId, params.nodeId,
         params.ownerServerId, allocationDataJson] as string[]
      )

      const [rows] = await conn.execute<AllocationRow[]>(
        `SELECT id, allocation_id, entity_id, node_id, status, owner_server_id,
                allocation_data, allocated_at, released_at, created_at, updated_at
         FROM atc_runtime_allocation WHERE entity_id = ? LIMIT 1`,
        [params.entityId]
      )
      if (!rows[0]) throw new Error(`Allocation not found after upsert: ${params.entityId}`)
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcRuntimeAllocation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AllocationRow[]>(
        `SELECT id, allocation_id, entity_id, node_id, status, owner_server_id,
                allocation_data, allocated_at, released_at, created_at, updated_at
         FROM atc_runtime_allocation WHERE entity_id = ? LIMIT 1`,
        [entityId]
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async release(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<AllocationRow[]>(
          `SELECT id FROM atc_runtime_allocation WHERE entity_id = ? LIMIT 1 FOR UPDATE`,
          [entityId]
        )
        if (!lockRows[0]) throw new AllocationNotFoundError(entityId)

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_runtime_allocation
           SET status = 'released', released_at = NOW(3), updated_at = NOW(3)
           WHERE entity_id = ?`,
          [entityId]
        )
        await conn.commit()
      } catch (err) {
        await conn.rollback()
        throw err
      }
    } finally {
      conn.release()
    }
  }

  async cleanupReleased(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_runtime_allocation
         WHERE status IN ('released', 'evicted')
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
