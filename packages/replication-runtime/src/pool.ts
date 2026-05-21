import type { Connection } from 'mysql2/promise'

export interface PoolConnection extends Connection {
  release(): void
}

export interface ReplicationRuntimePool {
  getConnection(): Promise<PoolConnection>
}
