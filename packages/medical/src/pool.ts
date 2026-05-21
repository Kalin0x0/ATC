import type { PoolConnection } from 'mysql2/promise'

export interface MedicalPool {
  getConnection(): Promise<PoolConnection>
}
