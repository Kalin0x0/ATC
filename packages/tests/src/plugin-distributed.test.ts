import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcPluginDistributedState } from '@atc/plugin-runtime'
import type { AtcPluginHealthSnapshot } from '@atc/shared-types'

function makeRedis() {
  return {
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue(null),
    hdel: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  }
}

function makeSnapshot(pluginId = 'my-plugin'): AtcPluginHealthSnapshot {
  return {
    pluginId,
    state: 'active',
    healthy: true,
    uptimeMs: 5000,
    restartCount: 0,
    crashCount: 0,
    lastError: null,
    lastCrashAt: null,
    resourceUsage: {
      activeTimers: 0,
      activeIntervals: 0,
      activeSubscriptions: 0,
      activeWorkers: 0,
      estimatedMemoryBytes: 0,
    },
    capturedAt: new Date().toISOString(),
  }
}

describe('AtcPluginDistributedState', () => {
  let redis: ReturnType<typeof makeRedis>
  let state: AtcPluginDistributedState

  beforeEach(() => {
    redis = makeRedis()
    state = new AtcPluginDistributedState(redis, 'instance-1')
  })

  describe('publishHealth()', () => {
    it('stores JSON at the correct key with TTL', async () => {
      const snapshot = makeSnapshot()
      await state.publishHealth('my-plugin', snapshot)
      expect(redis.set).toHaveBeenCalledWith(
        'atc:plugins:health:my-plugin:instance-1',
        expect.any(String),
        'EX',
        60,
      )
      const [, value] = redis.set.mock.calls[0]
      expect(JSON.parse(value as string).pluginId).toBe('my-plugin')
    })

    it('uses custom TTL when provided at construction', async () => {
      const customState = new AtcPluginDistributedState(redis, 'instance-1', 120)
      await customState.publishHealth('my-plugin', makeSnapshot())
      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        120,
      )
    })

    it('is fail-open — swallows Redis errors', async () => {
      redis.set.mockRejectedValue(new Error('connection refused'))
      await expect(state.publishHealth('my-plugin', makeSnapshot())).resolves.not.toThrow()
    })
  })

  describe('registerPlugin()', () => {
    it('HSETs instanceId into the nodes key', async () => {
      await state.registerPlugin('my-plugin')
      expect(redis.hset).toHaveBeenCalledWith(
        'atc:plugins:nodes:my-plugin',
        'instance-1',
        expect.any(String),
      )
    })

    it('is fail-open — swallows Redis errors', async () => {
      redis.hset.mockRejectedValue(new Error('connection refused'))
      await expect(state.registerPlugin('my-plugin')).resolves.not.toThrow()
    })
  })

  describe('deregisterPlugin()', () => {
    it('HDELs instanceId from the nodes key', async () => {
      await state.deregisterPlugin('my-plugin')
      expect(redis.hdel).toHaveBeenCalledWith('atc:plugins:nodes:my-plugin', 'instance-1')
    })

    it('is fail-open — swallows Redis errors', async () => {
      redis.hdel.mockRejectedValue(new Error('connection refused'))
      await expect(state.deregisterPlugin('my-plugin')).resolves.not.toThrow()
    })
  })

  describe('getNodesForPlugin()', () => {
    it('returns instance IDs from HGETALL', async () => {
      redis.hgetall.mockResolvedValue({ 'instance-1': '2026-01-01T00:00:00Z', 'instance-2': '2026-01-01T00:00:01Z' })
      const nodes = await state.getNodesForPlugin('my-plugin')
      expect(nodes).toContain('instance-1')
      expect(nodes).toContain('instance-2')
      expect(nodes).toHaveLength(2)
    })

    it('returns empty array when no nodes registered', async () => {
      redis.hgetall.mockResolvedValue(null)
      const nodes = await state.getNodesForPlugin('my-plugin')
      expect(nodes).toEqual([])
    })

    it('returns empty array on Redis error', async () => {
      redis.hgetall.mockRejectedValue(new Error('timeout'))
      const nodes = await state.getNodesForPlugin('my-plugin')
      expect(nodes).toEqual([])
    })
  })

  describe('getHealthForPlugin()', () => {
    it('returns parsed snapshot when key exists', async () => {
      const snapshot = makeSnapshot('my-plugin')
      redis.get.mockResolvedValue(JSON.stringify(snapshot))
      const result = await state.getHealthForPlugin('my-plugin', 'instance-1')
      expect(result?.pluginId).toBe('my-plugin')
      expect(result?.healthy).toBe(true)
    })

    it('returns null when key is missing', async () => {
      redis.get.mockResolvedValue(null)
      const result = await state.getHealthForPlugin('my-plugin', 'instance-1')
      expect(result).toBeNull()
    })

    it('returns null on Redis error', async () => {
      redis.get.mockRejectedValue(new Error('timeout'))
      const result = await state.getHealthForPlugin('my-plugin', 'instance-1')
      expect(result).toBeNull()
    })

    it('uses correct Redis key: atc:plugins:health:{pluginId}:{instanceId}', async () => {
      redis.get.mockResolvedValue(null)
      await state.getHealthForPlugin('my-plugin', 'node-x')
      expect(redis.get).toHaveBeenCalledWith('atc:plugins:health:my-plugin:node-x')
    })
  })
})
