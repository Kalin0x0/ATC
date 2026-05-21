import type { PoolConnection } from 'mysql2/promise'

export interface FactionPool {
  getConnection(): Promise<PoolConnection>
}
