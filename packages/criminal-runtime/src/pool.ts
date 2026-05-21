import type { PoolConnection } from 'mysql2/promise'

export interface CriminalPool {
  getConnection(): Promise<PoolConnection>
}
