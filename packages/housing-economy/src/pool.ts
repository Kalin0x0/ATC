import type { PoolConnection } from 'mysql2/promise'

export interface HousingEconomyPool {
  getConnection(): Promise<PoolConnection>
}
