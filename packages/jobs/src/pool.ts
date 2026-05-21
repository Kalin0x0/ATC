import type { PoolConnection } from 'mysql2/promise'

export interface JobsPool {
  getConnection(): Promise<PoolConnection>
}
