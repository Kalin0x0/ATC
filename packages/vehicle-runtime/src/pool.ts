import type { PoolConnection } from 'mysql2/promise'

export interface VehiclePool {
  getConnection(): Promise<PoolConnection>
}
