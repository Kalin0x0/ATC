import type { RowDataPacket } from 'mysql2/promise'
import type { WorldOrchestratorPool } from './pool.js'
import { generateId } from './id.js'
import { RuntimeAllocationNotFoundError } from './errors.js'

export type AtcAllocationType = 'initial' | 'migration' | 'rebalance' | 'recovery' | 'custom'
export type AtcAllocationStatus = 'active' | 'draining' | 'deallocated'

export interface AtcRuntimeAllocation {
  id: string
  allocationId: string
  shardId: string
  serverId: string
  allocationType: AtcAllocationType
  status: AtcAllocationStatus
  allocationData: Record<string, unknown>
  deallocatedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateAllocationParams {
  shardId: string
  serverId: string
  allocationType: AtcAllocationType
  allocationData?: Record<string, unknown> | undefined
}

interface AtcRuntimeAllocationRow extends RowDataPacket {
  id: string
  allocation_id: string
  shard_id: string
  server_id: string
  allocation_type: string
  status: string
  allocation_data: string
  deallocated_at: Date | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: AtcRuntimeAllocationRow): AtcRuntimeAllocation {
  return {
    id: row.id,
    allocationId: row.allocation_id,
    shardId: row.shard_id,
    serverId: row.server_id,
    allocationType: row.allocation_type as AtcAllocationType,
    status: row.status as AtcAllocationStatus,
    allocationData: JSON.parse(row.allocation_data) as Record<string, unknown>,
    deallocatedAt: row.deallocated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class RuntimeAllocationRepository {
  constructor(private readonly pool: WorldOrchestratorPool) {}

  async findByAllocationId(allocationId: string): Promise<AtcRuntimeAllocation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcRuntimeAllocationRow[]>(
        `SELECT id, allocation_id, shard_id, server_id, allocation_type, status,
                allocation_data, deallocated_at, created_at, updated_at
         FROM atc_runtime_allocations
         WHERE allocation_id = ?
         LIMIT 1`,
        [allocationId],
      )
      if (!rows[0]) return null
      return mapRow(rows[0])
    } finally {
      conn.release()
    }
  }

  async create(params: CreateAllocationParams): Promise<AtcRuntimeAllocation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const allocationId = generateId()
      const allocationData = JSON.stringify(params.allocationData ?? {})

      await conn.execute(
        `INSERT INTO atc_runtime_allocations
           (id, allocation_id, shard_id, server_id, allocation_type, status, allocation_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, NOW(3), NOW(3))`,
        [id, allocationId, params.shardId, params.serverId, params.allocationType, allocationData],
      )

      const result = await this.findByAllocationId(allocationId)
      if (!result) throw new RuntimeAllocationNotFoundError(allocationId)
      return result
    } finally {
      conn.release()
    }
  }

  async transition(allocationId: string, status: AtcAllocationStatus): Promise<AtcRuntimeAllocation> {
    const conn = await this.pool.getConnection()
    await conn.beginTransaction()
    try {
      const [rows] = await conn.execute<AtcRuntimeAllocationRow[]>(
        `SELECT id, allocation_id, shard_id, server_id, allocation_type, status,
                allocation_data, deallocated_at, created_at, updated_at
         FROM atc_runtime_allocations
         WHERE allocation_id = ?
         LIMIT 1
         FOR UPDATE`,
        [allocationId],
      )

      if (!rows[0]) {
        throw new RuntimeAllocationNotFoundError(allocationId)
      }

      const deallocatedAt = status === 'deallocated' ? 'NOW(3)' : 'NULL'

      await conn.execute(
        `UPDATE atc_runtime_allocations
         SET status = ?, deallocated_at = ${deallocatedAt}, updated_at = NOW(3)
         WHERE allocation_id = ?`,
        [status, allocationId],
      )

      await conn.commit()

      const result = await this.findByAllocationId(allocationId)
      if (!result) throw new RuntimeAllocationNotFoundError(allocationId)
      return result
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async listByShardId(shardId: string): Promise<AtcRuntimeAllocation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcRuntimeAllocationRow[]>(
        `SELECT id, allocation_id, shard_id, server_id, allocation_type, status,
                allocation_data, deallocated_at, created_at, updated_at
         FROM atc_runtime_allocations
         WHERE shard_id = ?
         ORDER BY created_at ASC`,
        [shardId],
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async listActive(): Promise<AtcRuntimeAllocation[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<AtcRuntimeAllocationRow[]>(
        `SELECT id, allocation_id, shard_id, server_id, allocation_type, status,
                allocation_data, deallocated_at, created_at, updated_at
         FROM atc_runtime_allocations
         WHERE status = 'active'
         ORDER BY created_at ASC`,
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }
}
