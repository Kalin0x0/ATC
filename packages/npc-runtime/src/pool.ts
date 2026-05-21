import type { PoolConnection } from 'mysql2/promise'

export interface NpcRuntimePool {
  getConnection(): Promise<PoolConnection>
}
