import type { PoolConnection } from 'mysql2/promise'

/**
 * Duck-typed pool interface — avoids direct mysql2 dependency on callers.
 * Compatible with the DbPool from @atc/db (mysql2 Pool satisfies this shape).
 */
export interface PrincipalStorePool {
  getConnection(): Promise<PoolConnection>
}
