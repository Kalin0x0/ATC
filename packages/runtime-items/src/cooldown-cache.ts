import type { RedisClient } from '@atc/cache'
import type { AtcItemCooldown } from '@atc/shared-types'

const KEY_PREFIX = 'atc:item:cooldown:'

function key(characterId: string, slot: number): string {
  return `${KEY_PREFIX}${characterId}:${slot}`
}

export class ItemCooldownCache {
  constructor(private readonly redis: RedisClient) {}

  async get(characterId: string, slot: number): Promise<AtcItemCooldown | null> {
    const raw = await this.redis.get(key(characterId, slot))
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as { expiresAt: string }
      const expiresAt = new Date(parsed.expiresAt)
      if (expiresAt <= new Date()) {
        await this.redis.del(key(characterId, slot)).catch(() => undefined)
        return null
      }
      return { characterId, slot, expiresAt }
    } catch {
      return null
    }
  }

  async set(characterId: string, slot: number, cooldownMs: number): Promise<Date> {
    const expiresAt = new Date(Date.now() + cooldownMs)
    const ttlSeconds = Math.max(1, Math.ceil(cooldownMs / 1000))
    await this.redis.setex(
      key(characterId, slot),
      ttlSeconds,
      JSON.stringify({ expiresAt: expiresAt.toISOString() }),
    )
    return expiresAt
  }

  async clear(characterId: string, slot: number): Promise<void> {
    await this.redis.del(key(characterId, slot))
  }
}
