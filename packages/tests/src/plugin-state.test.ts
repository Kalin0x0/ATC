import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcPluginStateService } from '@atc/plugin-state'

// ── in-memory only (no Redis) ─────────────────────────────────────────────────

describe('AtcPluginStateService — in-memory (no Redis)', () => {
  it('load returns undefined for unknown plugin', async () => {
    const svc = new AtcPluginStateService()
    expect(await svc.load('unknown')).toBeUndefined()
  })

  it('save and load round-trip', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', { enabled: false, crashCount: 2 })
    const state = await svc.load('p1')
    expect(state?.pluginId).toBe('p1')
    expect(state?.enabled).toBe(false)
    expect(state?.crashCount).toBe(2)
  })

  it('save merges with existing state (does not wipe unrelated fields)', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', { crashCount: 3 })
    await svc.save('p1', { enabled: false })
    const state = await svc.load('p1')
    expect(state?.crashCount).toBe(3)
    expect(state?.enabled).toBe(false)
  })

  it('save initialises defaults for new plugin', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', {})
    const state = await svc.load('p1')
    expect(state?.enabled).toBe(true)
    expect(state?.crashCount).toBe(0)
    expect(state?.lastLoadedAt).toBeNull()
  })

  it('clear removes plugin from memory', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', { crashCount: 1 })
    await svc.clear('p1')
    expect(await svc.load('p1')).toBeUndefined()
  })

  it('clearAll empties all entries', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', {})
    await svc.save('p2', {})
    await svc.clearAll()
    const all = await svc.loadAll()
    expect(all.size).toBe(0)
  })

  it('loadAll returns all saved states', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', { crashCount: 1 })
    await svc.save('p2', { enabled: false })
    const all = await svc.loadAll()
    expect(all.size).toBe(2)
    expect(all.get('p1')?.crashCount).toBe(1)
    expect(all.get('p2')?.enabled).toBe(false)
  })

  it('loadAll returns copies (mutations do not affect internal state)', async () => {
    const svc = new AtcPluginStateService()
    await svc.save('p1', { crashCount: 0 })
    const all = await svc.loadAll()
    all.get('p1')!.crashCount = 999
    const reloaded = await svc.load('p1')
    expect(reloaded?.crashCount).toBe(0)
  })
})

// ── incrementCrashCount ────────────────────────────────────────────────────────

describe('AtcPluginStateService — incrementCrashCount', () => {
  it('increments from 0 to 1', async () => {
    const svc = new AtcPluginStateService()
    const count = await svc.incrementCrashCount('p1')
    expect(count).toBe(1)
  })

  it('increments multiple times', async () => {
    const svc = new AtcPluginStateService()
    await svc.incrementCrashCount('p1')
    await svc.incrementCrashCount('p1')
    const count = await svc.incrementCrashCount('p1')
    expect(count).toBe(3)
  })

  it('persists incremented value', async () => {
    const svc = new AtcPluginStateService()
    await svc.incrementCrashCount('p1')
    await svc.incrementCrashCount('p1')
    const state = await svc.load('p1')
    expect(state?.crashCount).toBe(2)
  })
})

// ── setEnabled ────────────────────────────────────────────────────────────────

describe('AtcPluginStateService — setEnabled', () => {
  it('sets enabled true and records lastLoadedAt', async () => {
    const svc = new AtcPluginStateService()
    await svc.setEnabled('p1', true)
    const state = await svc.load('p1')
    expect(state?.enabled).toBe(true)
    expect(state?.lastLoadedAt).not.toBeNull()
  })

  it('sets enabled false and clears lastLoadedAt', async () => {
    const svc = new AtcPluginStateService()
    await svc.setEnabled('p1', true)
    await svc.setEnabled('p1', false)
    const state = await svc.load('p1')
    expect(state?.enabled).toBe(false)
    expect(state?.lastLoadedAt).toBeNull()
  })
})

// ── Redis fallback ─────────────────────────────────────────────────────────────

describe('AtcPluginStateService — Redis fallback', () => {
  function makeMockRedis(overrides: Partial<{
    get: (key: string) => Promise<string | null>
    pipeline: () => unknown
    keys: (pattern: string) => Promise<string[]>
    mget: (...keys: string[]) => Promise<(string | null)[]>
    del: (...keys: string[]) => Promise<number>
  }> = {}) {
    const pipe = {
      set: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }
    return {
      get: vi.fn().mockResolvedValue(null),
      pipeline: vi.fn().mockReturnValue(pipe),
      keys: vi.fn().mockResolvedValue([]),
      mget: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(1),
      ...overrides,
      _pipe: pipe,
    }
  }

  it('writes to Redis pipeline on save', async () => {
    const redis = makeMockRedis()
    const svc = new AtcPluginStateService(redis as never)
    await svc.save('p1', { crashCount: 5 })
    expect(redis._pipe.set).toHaveBeenCalled()
    expect(redis._pipe.expire).toHaveBeenCalled()
    expect(redis._pipe.exec).toHaveBeenCalled()
  })

  it('reads from Redis on load when key exists', async () => {
    const stored: Record<string, string> = {
      'atc:plugin:state:p1': JSON.stringify({ pluginId: 'p1', enabled: true, crashCount: 7, lastLoadedAt: null, settings: {} }),
    }
    const redis = makeMockRedis({
      get: vi.fn().mockImplementation((k: string) => Promise.resolve(stored[k] ?? null)),
    })
    const svc = new AtcPluginStateService(redis as never)
    const state = await svc.load('p1')
    expect(state?.crashCount).toBe(7)
  })

  it('falls back to in-memory when Redis.get throws', async () => {
    const redis = makeMockRedis({
      get: vi.fn().mockRejectedValue(new Error('Redis down')),
    })
    const svc = new AtcPluginStateService(redis as never)
    // Pre-populate in-memory by saving (Redis pipeline will also throw but is caught)
    redis._pipe.exec = vi.fn().mockRejectedValue(new Error('Redis down'))
    await svc.save('p1', { crashCount: 3 })
    // Now load: Redis throws, should return in-memory value
    const state = await svc.load('p1')
    expect(state?.crashCount).toBe(3)
  })

  it('falls back to in-memory on loadAll when Redis throws', async () => {
    const redis = makeMockRedis({
      keys: vi.fn().mockRejectedValue(new Error('Redis down')),
    })
    const svc = new AtcPluginStateService(redis as never)
    redis._pipe.exec = vi.fn().mockRejectedValue(new Error('Redis down'))
    await svc.save('p1', {})
    const all = await svc.loadAll()
    expect(all.get('p1')).toBeDefined()
  })

  it('clear does not throw when Redis.del throws', async () => {
    const redis = makeMockRedis({
      del: vi.fn().mockRejectedValue(new Error('Redis down')),
    })
    const svc = new AtcPluginStateService(redis as never)
    await svc.save('p1', {})
    await expect(svc.clear('p1')).resolves.toBeUndefined()
  })
})
