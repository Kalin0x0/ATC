import type { Pool } from 'mysql2/promise'

/**
 * Opaque pool type used by the entity-graph repositories. Any mysql2-compatible
 * Pool can be passed; the package never creates pools itself.
 */
export type EntityGraphPool = Pool
