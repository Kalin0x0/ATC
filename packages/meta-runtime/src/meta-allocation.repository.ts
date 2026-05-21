import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { MetaRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcAllocationType = 'compute' | 'memory' | 'network' | 'storage' | 'process' | 'custom'
export type AtcAllocationStatus = 'allocated' | 'released' | 'overloaded' | 'reserved'

export interface AtcMetaAllocation {
  id: string
  entityId: string
  allocationType: AtcAllocationType
  status: AtcAllocationStatus
  ownerServerId: string
  allocationData: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UpsertMetaAllocationParams {
  entityId: string
  allocationType: AtcAllocationType
  ownerServerId: string
  allocationData?: Record<string, unknown> | undefined
}

interface MetaAllocationRow extends RowDataPacket {
  id: string
  entity_id: string
  allocation_type: string
  status: string
  owner_server_id: string
  allocation_data: string | null
  created_at: Date
  updated_at: Date
}

function mapRow(row: MetaAllocationRow): AtcMetaAllocation {
  let allocationData: Record<string, unknown> = {}
  if (row.allocation_data) {
    try { allocationData = JSON.parse(row.allocation_data) as Record<string, unknown> } catch { allocationData = {} }
  }
  return {
    id: row.id,
    entityId: row.entity_id,
    allocationType: row.allocation_type as AtcAllocationType,
    status: row.status as AtcAllocationStatus,
    ownerServerId: row.owner_server_id,
    allocationData,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class MetaAllocationRepository {
  constructor(private readonly pool: MetaRuntimePool) {}

  async upsert(params: UpsertMetaAllocationParams): Promise<AtcMetaAllocation> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const allocationDataJson = JSON.stringify(params.allocationData ?? {})

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_meta_allocations
           (id, entity_id, allocation_type, status, owner_server_id, allocation_data, created_at, updated_at)
         VALUES (?, ?, ?, 'allocated', ?, ?, NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           allocation_type = VALUES(allocation_type),
           status = 'allocated',
           owner_server_id = VALUES(owner_server_id),
           allocation_data = VALUES(allocation_data),
           updated_at = NOW(3)`,
        [id, params.entityId, params.allocationType, params.ownerServerId, allocationDataJson] as string[],
      )

      const [rows] = await conn.execute<MetaAllocationRow[]>(
        `SELECT id, entity_id, allocation_type, status, owner_server_id, allocation_data, created_at, updated_at
         FROM atc_meta_allocations WHERE entity_id = ? LIMIT 1`,
        [params.entityId],
      )
      const row = rows[0]
      if (!row) throw new Error(`Allocation not found after upsert: ${params.entityId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async findByEntity(entityId: string): Promise<AtcMetaAllocation | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<MetaAllocationRow[]>(
        `SELECT id, entity_id, allocation_type, status, owner_server_id, allocation_data, created_at, updated_at
         FROM atc_meta_allocations WHERE entity_id = ? LIMIT 1`,
        [entityId],
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async release(entityId: string): Promise<void> {
    const conn = await this.pool.getConnection()
    try {
      await conn.beginTransaction()
      try {
        const [lockRows] = await conn.execute<MetaAllocationRow[]>(
          `SELECT id FROM atc_meta_allocations WHERE entity_id = ? LIMIT 1 FOR UPDATE`,
          [entityId],
        )
        const lockRow = lockRows[0]
        if (!lockRow) {
          await conn.rollback()
          return
        }

        await conn.execute<ResultSetHeader>(
          `UPDATE atc_meta_allocations SET status = 'released', updated_at = NOW(3) WHERE entity_id = ?`,
          [entityId],
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
        `DELETE FROM atc_meta_allocations
         WHERE status = 'released'
           AND updated_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs],
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
