import type { PoolConnection } from 'mysql2/promise'

export interface PropertyPool {
  getConnection(): Promise<PoolConnection>
}
