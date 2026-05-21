import type { Connection } from 'mysql2/promise'

interface PoolConnection extends Connection {
  release(): void
}

export type { PoolConnection }

export interface GovernanceRuntimePool {
  getConnection(): Promise<PoolConnection>
}
