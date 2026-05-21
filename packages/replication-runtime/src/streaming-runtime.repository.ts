import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import type { ReplicationRuntimePool } from './pool.js'
import { generateId } from './id.js'

export type AtcStreamingState = 'active' | 'paused' | 'frozen' | 'culled'

export interface AtcStreamingRuntime {
  id: string
  entityId: string
  streamingState: AtcStreamingState
  ownerServerId: string | null
  lastStreamAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UpsertStreamingParams {
  entityId: string
  streamingState: AtcStreamingState
  ownerServerId?: string | undefined
}

interface StreamingRuntimeRow extends RowDataPacket {
  id: string
  entity_id: string
  streaming_state: string
  owner_server_id: string | null
  last_stream_at: Date
  created_at: Date
  updated_at: Date
}

function mapRow(row: StreamingRuntimeRow): AtcStreamingRuntime {
  return {
    id: row.id,
    entityId: row.entity_id,
    streamingState: row.streaming_state as AtcStreamingState,
    ownerServerId: row.owner_server_id,
    lastStreamAt: row.last_stream_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class StreamingRuntimeRepository {
  constructor(private readonly pool: ReplicationRuntimePool) {}

  async findByEntityId(entityId: string): Promise<AtcStreamingRuntime | null> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StreamingRuntimeRow[]>(
        `SELECT id, entity_id, streaming_state, owner_server_id, last_stream_at, created_at, updated_at
         FROM atc_streaming_runtime
         WHERE entity_id = ?
         LIMIT 1`,
        [entityId]
      )
      const row = rows[0]
      if (!row) return null
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async upsert(params: UpsertStreamingParams): Promise<AtcStreamingRuntime> {
    const conn = await this.pool.getConnection()
    try {
      const id = generateId()
      const ownerServerId = params.ownerServerId ?? null

      await conn.execute<ResultSetHeader>(
        `INSERT INTO atc_streaming_runtime
           (id, entity_id, streaming_state, owner_server_id, last_stream_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(3), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           streaming_state = VALUES(streaming_state),
           owner_server_id = VALUES(owner_server_id),
           last_stream_at = NOW(3),
           updated_at = NOW(3)`,
        [id, params.entityId, params.streamingState, ownerServerId]
      )

      const [rows] = await conn.execute<StreamingRuntimeRow[]>(
        `SELECT id, entity_id, streaming_state, owner_server_id, last_stream_at, created_at, updated_at
         FROM atc_streaming_runtime
         WHERE entity_id = ?
         LIMIT 1`,
        [params.entityId]
      )
      const row = rows[0]
      if (!row) throw new Error(`Streaming runtime not found after upsert: ${params.entityId}`)
      return mapRow(row)
    } finally {
      conn.release()
    }
  }

  async listByServerId(serverId: string): Promise<AtcStreamingRuntime[]> {
    const conn = await this.pool.getConnection()
    try {
      const [rows] = await conn.execute<StreamingRuntimeRow[]>(
        `SELECT id, entity_id, streaming_state, owner_server_id, last_stream_at, created_at, updated_at
         FROM atc_streaming_runtime
         WHERE owner_server_id = ?
         ORDER BY created_at ASC`,
        [serverId]
      )
      return rows.map(mapRow)
    } finally {
      conn.release()
    }
  }

  async deleteStale(thresholdMs: number): Promise<number> {
    const conn = await this.pool.getConnection()
    try {
      const [result] = await conn.execute<ResultSetHeader>(
        `DELETE FROM atc_streaming_runtime
         WHERE last_stream_at < DATE_SUB(NOW(3), INTERVAL ? MILLISECOND)`,
        [thresholdMs]
      )
      return result.affectedRows
    } finally {
      conn.release()
    }
  }
}
