import type { AtcStatusEffect } from '@atc/shared-types'
import type { RedisClient } from './client.js'

const KEY_PREFIX = 'atc:status:character:'

/**
 * 24 hours, refreshed on every write. Status effects are cache-only — there is
 * no table behind them — so this is the outer bound on a character's effects
 * surviving without anyone touching them, not a per-effect lifetime. Each
 * effect's own `expiresAt` is what actually ends it.
 */
const TTL_SECONDS = 86_400

function key(characterId: string): string {
  return `${KEY_PREFIX}${characterId}`
}

/**
 * A character's active status effects, one Redis hash per character with the
 * effect type as the field.
 *
 * A hash rather than a key per effect: the type being the field is what makes
 * applying an effect an upsert — a second `fatigue` replaces the first instead
 * of stacking — and it lets a whole character's effects be read in one call.
 */
export class StatusEffectCache {
  constructor(private readonly redis: RedisClient) {}

  /**
   * Apply an effect, replacing any existing one of the same type.
   *
   * The write and the TTL refresh go out as one pipeline, so a crash between
   * them cannot leave a character's effects without an expiry.
   */
  async apply(characterId: string, effect: AtcStatusEffect): Promise<void> {
    const hashKey = key(characterId)
    await this.redis
      .pipeline()
      .hset(hashKey, effect.type, JSON.stringify(effect))
      .expire(hashKey, TTL_SECONDS)
      .exec()
  }

  /**
   * A character's active effects.
   *
   * Expired and corrupt entries are pruned as they are found: there is no
   * sweeper behind this, so a read is the only thing that ever removes them.
   *
   * Returns `[]` when Redis is unreachable rather than throwing. This is the one
   * cache here that does so, and deliberately: unlike sessions and vitals there
   * is no database to fall back to, so the choice is between "no effects" and
   * failing the request outright — and no effects is what a character had before
   * any were applied.
   */
  async list(characterId: string): Promise<AtcStatusEffect[]> {
    const hashKey = key(characterId)
    let hash: Record<string, string> | null
    try {
      hash = await this.redis.hgetall(hashKey)
    } catch {
      return []
    }
    if (hash === null) return []

    const now = Date.now()
    const active: AtcStatusEffect[] = []
    const stale: string[] = []

    for (const [type, raw] of Object.entries(hash)) {
      let effect: AtcStatusEffect
      try {
        effect = JSON.parse(raw) as AtcStatusEffect
      } catch {
        stale.push(type)
        continue
      }
      if (effect.expiresAt !== null && new Date(effect.expiresAt).getTime() <= now) {
        stale.push(type)
        continue
      }
      active.push(effect)
    }

    for (const type of stale) {
      await this.redis.hdel(hashKey, type).catch(() => undefined)
    }

    return active
  }

  /** Remove one effect type. A no-op when the character does not have it. */
  async clear(characterId: string, type: string): Promise<void> {
    await this.redis.hdel(key(characterId), type)
  }

  /** Remove every effect a character has — on death or respawn, for instance. */
  async clearAll(characterId: string): Promise<void> {
    await this.redis.del(key(characterId))
  }

  /**
   * Remove expired effects without reading the survivors back.
   *
   * `list` already prunes, so this is for a caller that only wants the cleanup —
   * a background sweep over characters nobody is currently reading.
   *
   * @returns how many were removed; 0 when Redis is unreachable, since nothing
   *          was removed either way
   */
  async pruneExpired(characterId: string): Promise<number> {
    const hashKey = key(characterId)
    let hash: Record<string, string> | null
    try {
      hash = await this.redis.hgetall(hashKey)
    } catch {
      return 0
    }
    if (hash === null) return 0

    const now = Date.now()
    let pruned = 0

    for (const [type, raw] of Object.entries(hash)) {
      let expired: boolean
      try {
        const effect = JSON.parse(raw) as AtcStatusEffect
        expired = effect.expiresAt !== null && new Date(effect.expiresAt).getTime() <= now
      } catch {
        // Unparseable is as good as expired: nothing can read it.
        expired = true
      }
      if (expired) {
        await this.redis.hdel(hashKey, type).catch(() => undefined)
        pruned++
      }
    }

    return pruned
  }
}
