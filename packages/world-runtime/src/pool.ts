import type { PoolConnection } from 'mysql2/promise'

export interface WorldPool {
  getConnection(): Promise<PoolConnection>
}
