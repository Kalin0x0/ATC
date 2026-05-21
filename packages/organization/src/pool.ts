import type { PoolConnection } from 'mysql2/promise'

export interface OrganizationPool {
  getConnection(): Promise<PoolConnection>
}
