import type { PoolConnection } from 'mysql2/promise'

export interface VehicleSimPool {
  getConnection(): Promise<PoolConnection>
}
