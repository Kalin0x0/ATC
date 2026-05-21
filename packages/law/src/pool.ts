import type { PoolConnection } from 'mysql2/promise'

export interface LawPool {
  getConnection(): Promise<PoolConnection>
}
