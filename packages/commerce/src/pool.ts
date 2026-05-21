import type { PoolConnection } from 'mysql2/promise'

/**
 * Duck-typed pool interface — avoids circular dependency on @atc/db.
 * Compatible with mysql2 Pool (DbPool from @atc/db satisfies this shape).
 */
export interface CommercePool {
  getConnection(): Promise<PoolConnection>
}
