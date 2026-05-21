import type { PoolConnection } from 'mysql2/promise'

export interface DispatchPool {
  getConnection(): Promise<PoolConnection>
}
