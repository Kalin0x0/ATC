import type { PoolConnection } from 'mysql2/promise'

export interface CityRuntimePool {
  getConnection(): Promise<PoolConnection>
}
