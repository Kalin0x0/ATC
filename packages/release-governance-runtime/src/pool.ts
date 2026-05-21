import type { FieldPacket } from 'mysql2/promise'

export interface PoolConnection {
  execute<T>(sql: string, values?: unknown[]): Promise<[T, FieldPacket[]]>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}

export interface ReleaseGovernancePool {
  getConnection(): Promise<PoolConnection>
}
