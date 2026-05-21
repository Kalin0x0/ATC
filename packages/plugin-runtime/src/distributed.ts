import type { AtcPluginHealthSnapshot } from '@atc/shared-types'

// Duck-typed Redis interface — avoids ioredis import in this package
export interface PluginDistributedRedis {
  hset(key: string, field: string, value: string): Promise<unknown>
  hgetall(key: string): Promise<Record<string, string> | null>
  hdel(key: string, field: string): Promise<unknown>
  set(key: string, value: string, exMode: 'EX', ttl: number): Promise<unknown>
  get(key: string): Promise<string | null>
}

/**
 * Publishes per-plugin health snapshots and node membership to Redis
 * so cluster peers can read plugin state.
 *
 * Redis keys:
 *   atc:plugins:nodes:{pluginId}            — HSET, field=instanceId, value=ISO timestamp
 *   atc:plugins:health:{pluginId}:{instanceId} — SETEX, value=JSON(AtcPluginHealthSnapshot)
 *
 * All operations are fail-open — Redis unavailability is silently swallowed.
 */
export class AtcPluginDistributedState {
  constructor(
    private readonly _redis: PluginDistributedRedis,
    private readonly _instanceId: string,
    private readonly _healthTtlSeconds = 60,
  ) {}

  async publishHealth(pluginId: string, snapshot: AtcPluginHealthSnapshot): Promise<void> {
    try {
      const key = `atc:plugins:health:${pluginId}:${this._instanceId}`
      await this._redis.set(key, JSON.stringify(snapshot), 'EX', this._healthTtlSeconds)
    } catch { /* fail-open */ }
  }

  async registerPlugin(pluginId: string): Promise<void> {
    try {
      await this._redis.hset(
        `atc:plugins:nodes:${pluginId}`,
        this._instanceId,
        new Date().toISOString(),
      )
    } catch { /* fail-open */ }
  }

  async deregisterPlugin(pluginId: string): Promise<void> {
    try {
      await this._redis.hdel(`atc:plugins:nodes:${pluginId}`, this._instanceId)
    } catch { /* fail-open */ }
  }

  async getNodesForPlugin(pluginId: string): Promise<string[]> {
    try {
      const result = await this._redis.hgetall(`atc:plugins:nodes:${pluginId}`)
      return result ? Object.keys(result) : []
    } catch {
      return []
    }
  }

  async getHealthForPlugin(
    pluginId: string,
    instanceId: string,
  ): Promise<AtcPluginHealthSnapshot | null> {
    try {
      const raw = await this._redis.get(`atc:plugins:health:${pluginId}:${instanceId}`)
      if (!raw) return null
      return JSON.parse(raw) as AtcPluginHealthSnapshot
    } catch {
      return null
    }
  }
}
