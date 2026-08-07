import type { AtcSessionResponse } from '@atc/shared-types'
import type { RedisClient } from './client.js'

const KEY_PREFIX = 'atc:session:source:'

/**
 * Five minutes. A session is refreshed on every request that touches it, so this
 * bounds how long a stale entry can outlive a player who vanished without a
 * clean disconnect — not how long a live session lasts.
 */
const TTL_SECONDS = 300

function key(source: number): string {
  return `${KEY_PREFIX}${source}`
}

/**
 * The connected-session lookup, keyed by FiveM source.
 *
 * Source rather than session id on purpose: every caller starts from a player on
 * the server and wants their session, not the other way round.
 */
export class SessionCache {
  constructor(private readonly redis: RedisClient) {}

  /**
   * The cached session, or null when there is none.
   *
   * A corrupt entry is evicted and reported as a miss: it can only have come
   * from a partial write or a version skew, and leaving it in place would fail
   * every read until it expired. Redis failures are *not* swallowed — a caller
   * that wants to fall back to the database has to be able to tell "no session"
   * from "cannot reach the cache".
   */
  async get(source: number): Promise<AtcSessionResponse | null> {
    const raw = await this.redis.get(key(source))
    if (raw === null) return null
    try {
      return JSON.parse(raw) as AtcSessionResponse
    } catch {
      // Eviction is best-effort: the caller asked for a session, and failing
      // their read because the cleanup failed would help nobody.
      await this.redis.del(key(source)).catch(() => undefined)
      return null
    }
  }

  /** Store a session, replacing any entry for that source and resetting its TTL. */
  async set(session: AtcSessionResponse): Promise<void> {
    await this.redis.setex(key(session.source), TTL_SECONDS, JSON.stringify(session))
  }

  async del(source: number): Promise<void> {
    await this.redis.del(key(source))
  }

  /**
   * Extend the TTL without rewriting the entry. A no-op when the key is already
   * gone, which is the right outcome: there is nothing to keep alive.
   */
  async refresh(source: number): Promise<void> {
    await this.redis.expire(key(source), TTL_SECONDS)
  }
}
