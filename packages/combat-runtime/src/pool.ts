import type { PoolConnection } from 'mysql2/promise'

export interface CombatPool {
  getConnection(): Promise<PoolConnection>
}
