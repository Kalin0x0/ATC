import type { Connection } from 'mysql2/promise'

/**
 * The connection shape this package uses.
 *
 * Extends mysql2's own Connection rather than re-declaring its methods. The
 * hand-written version that stood here claimed `execute<T>(sql, values?:
 * unknown[])`, which the real client does not satisfy — mysql2 constrains T to
 * QueryResult and takes a narrower values type — so a genuine mysql2 pool could
 * not be passed to this package at all. Nothing noticed while nothing wired it.
 */
export interface PoolConnection extends Connection {
  release(): void
}

export interface DeveloperPlatformPool {
  getConnection(): Promise<PoolConnection>
}
