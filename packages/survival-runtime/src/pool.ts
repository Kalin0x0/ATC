import type { PoolConnection } from 'mysql2/promise'

export interface SurvivalRuntimePool {
  getConnection(): Promise<PoolConnection>
}
