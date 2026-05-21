import type { PoolConnection } from 'mysql2/promise'

export type { PoolConnection }

export interface TransportRuntimePool {
  getConnection(): Promise<PoolConnection>
}
