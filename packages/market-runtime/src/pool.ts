import type { PoolConnection } from 'mysql2/promise'

export interface MarketPool {
  getConnection(): Promise<PoolConnection>
}
