import type { AtcPluginPersistedState } from '@atc/shared-types'
import type { Redis } from 'ioredis'

const KEY_PREFIX = 'atc:plugin:state:'
const HASH_TTL_SECONDS = 86_400 * 30  // 30 days

function key(pluginId: string): string {
  return `${KEY_PREFIX}${pluginId}`
}

function makeDefault(pluginId: string): AtcPluginPersistedState {
  return {
    pluginId,
    enabled: true,
    crashCount: 0,
    lastLoadedAt: null,
    settings: {},
  }
}

export class AtcPluginStateService {
  private readonly _memory = new Map<string, AtcPluginPersistedState>()

  constructor(private readonly _redis?: Redis) {}

  async save(pluginId: string, update: Partial<Omit<AtcPluginPersistedState, 'pluginId'>>): Promise<void> {
    const current = await this.load(pluginId) ?? makeDefault(pluginId)
    const next: AtcPluginPersistedState = {
      ...current,
      ...update,
      pluginId,
    }

    this._memory.set(pluginId, next)

    if (this._redis) {
      try {
        await this._redis
          .pipeline()
          .set(key(pluginId), JSON.stringify(next))
          .expire(key(pluginId), HASH_TTL_SECONDS)
          .exec()
      } catch {
        // Non-fatal — in-memory fallback already updated
      }
    }
  }

  async load(pluginId: string): Promise<AtcPluginPersistedState | undefined> {
    if (this._redis) {
      try {
        const raw = await this._redis.get(key(pluginId))
        if (raw) {
          const parsed = JSON.parse(raw) as AtcPluginPersistedState
          this._memory.set(pluginId, parsed)
          return parsed
        }
      } catch {
        // Fallthrough to in-memory
      }
    }

    return this._memory.get(pluginId)
  }

  async loadAll(): Promise<Map<string, AtcPluginPersistedState>> {
    const result = new Map<string, AtcPluginPersistedState>()

    if (this._redis) {
      try {
        const keys = await this._redis.keys(`${KEY_PREFIX}*`)
        if (keys.length > 0) {
          const values = await this._redis.mget(...keys)
          for (let i = 0; i < keys.length; i++) {
            const raw = values[i]
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as AtcPluginPersistedState
                result.set(parsed.pluginId, parsed)
              } catch { /* skip malformed */ }
            }
          }
          return result
        }
      } catch { /* Fallthrough to in-memory */ }
    }

    for (const [id, state] of this._memory) {
      result.set(id, { ...state })
    }

    return result
  }

  async clear(pluginId: string): Promise<void> {
    this._memory.delete(pluginId)

    if (this._redis) {
      try {
        await this._redis.del(key(pluginId))
      } catch { /* Non-fatal */ }
    }
  }

  async clearAll(): Promise<void> {
    const ids = [...this._memory.keys()]
    this._memory.clear()

    if (this._redis) {
      try {
        const keys = await this._redis.keys(`${KEY_PREFIX}*`)
        if (keys.length > 0) {
          await this._redis.del(...keys)
        }
      } catch { /* Non-fatal */ }
    }
    void ids  // suppress unused warning
  }

  async incrementCrashCount(pluginId: string): Promise<number> {
    const current = await this.load(pluginId) ?? makeDefault(pluginId)
    const next = current.crashCount + 1
    await this.save(pluginId, { crashCount: next })
    return next
  }

  async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    await this.save(pluginId, { enabled, lastLoadedAt: enabled ? new Date().toISOString() : null })
  }
}
