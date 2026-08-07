import type { AtcCharacterVitals } from '@atc/shared-types'
import type { RedisClient } from './client.js'

const KEY_PREFIX = 'atc:vitals:character:'

/**
 * One minute. Vitals move constantly and are written through to the database on
 * every mutation, so this is a read shield in front of a hot row rather than a
 * store — a short life keeps a missed invalidation from mattering for long.
 */
const TTL_SECONDS = 60

function key(characterId: string): string {
  return `${KEY_PREFIX}${characterId}`
}

/** JSON has no date type, so the two timestamps come back as strings. */
interface SerialisedVitals extends Omit<AtcCharacterVitals, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export class VitalsCache {
  constructor(private readonly redis: RedisClient) {}

  /**
   * A character's cached vitals, or null on a miss.
   *
   * Timestamps are revived as `Date`, so a cache hit is the same shape as a
   * database read and callers never have to know which one they got.
   *
   * As in SessionCache: corrupt entries are evicted and read as a miss, while
   * Redis failures propagate so the caller can fall back to the database rather
   * than treat an outage as "this character has no vitals".
   */
  async get(characterId: string): Promise<AtcCharacterVitals | null> {
    const raw = await this.redis.get(key(characterId))
    if (raw === null) return null
    try {
      const parsed = JSON.parse(raw) as SerialisedVitals
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        updatedAt: new Date(parsed.updatedAt),
      }
    } catch {
      await this.redis.del(key(characterId)).catch(() => undefined)
      return null
    }
  }

  /**
   * Store a character's vitals.
   *
   * Throws when Redis does. Callers treat writing the cache as best-effort and
   * attach their own `.catch()`; swallowing it here would take that choice away
   * and hide an outage entirely.
   */
  async set(vitals: AtcCharacterVitals): Promise<void> {
    await this.redis.setex(key(vitals.characterId), TTL_SECONDS, JSON.stringify(vitals))
  }

  async del(characterId: string): Promise<void> {
    await this.redis.del(key(characterId))
  }

  /** Extend the TTL of an entry that is still being read but not written. */
  async refresh(characterId: string): Promise<void> {
    await this.redis.expire(key(characterId), TTL_SECONDS)
  }
}
