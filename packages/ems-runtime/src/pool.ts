import type { PoolConnection } from 'mysql2/promise'

export interface EmsPool {
  getConnection(): Promise<PoolConnection>
}
