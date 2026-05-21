import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VitalsCache } from '@atc/cache'
import type { AtcCharacterVitals } from '@atc/shared-types'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

function makeVitals(overrides: Partial<AtcCharacterVitals> = {}): AtcCharacterVitals {
  return {
    characterId: CHAR_ID,
    health:      100,
    hunger:      80,
    thirst:      60,
    stamina:     90,
    stress:      10,
    armor:       0,
    createdAt:   new Date('2026-01-01T00:00:00Z'),
    updatedAt:   new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

function makeRedis(overrides: Record<string, unknown> = {}) {
  return {
    setex:  vi.fn().mockResolvedValue('OK'),
    get:    vi.fn().mockResolvedValue(null),
    del:    vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ...overrides,
  }
}

// ── set & get ─────────────────────────────────────────────────────────────────

describe('VitalsCache — set & get', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('stores vitals with 60-second TTL', async () => {
    const redis = makeRedis()
    const cache = new VitalsCache(redis as never)
    await cache.set(makeVitals())
    expect(redis.setex).toHaveBeenCalledWith(
      `atc:vitals:character:${CHAR_ID}`,
      60,
      expect.any(String),
    )
  })

  it('returns null on cache miss', async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(null) })
    const cache = new VitalsCache(redis as never)
    expect(await cache.get(CHAR_ID)).toBeNull()
  })

  it('returns parsed vitals on cache hit', async () => {
    const vitals = makeVitals()
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(vitals)) })
    const cache = new VitalsCache(redis as never)
    const result = await cache.get(CHAR_ID)
    expect(result).not.toBeNull()
    expect(result!.health).toBe(100)
    expect(result!.hunger).toBe(80)
    expect(result!.createdAt).toBeInstanceOf(Date)
    expect(result!.updatedAt).toBeInstanceOf(Date)
  })
})

// ── corrupt JSON eviction ─────────────────────────────────────────────────────

describe('VitalsCache — corrupt JSON eviction', () => {
  it('evicts corrupt entry and returns null', async () => {
    const redis = makeRedis({ get: vi.fn().mockResolvedValue('{not:valid json') })
    const cache = new VitalsCache(redis as never)
    const result = await cache.get(CHAR_ID)
    expect(result).toBeNull()
    expect(redis.del).toHaveBeenCalledWith(`atc:vitals:character:${CHAR_ID}`)
  })
})

// ── Redis failure fallback ────────────────────────────────────────────────────

describe('VitalsCache — Redis failure', () => {
  it('get throws when Redis throws — caller must catch', async () => {
    const redis = makeRedis({ get: vi.fn().mockRejectedValue(new Error('Redis down')) })
    const cache = new VitalsCache(redis as never)
    await expect(cache.get(CHAR_ID)).rejects.toThrow('Redis down')
  })

  it('set throws when Redis throws — caller uses best-effort .catch()', async () => {
    const redis = makeRedis({ setex: vi.fn().mockRejectedValue(new Error('Redis down')) })
    const cache = new VitalsCache(redis as never)
    await expect(cache.set(makeVitals())).rejects.toThrow('Redis down')
  })
})

// ── del & refresh ─────────────────────────────────────────────────────────────

describe('VitalsCache — del & refresh', () => {
  it('deletes the correct key', async () => {
    const redis = makeRedis()
    const cache = new VitalsCache(redis as never)
    await cache.del(CHAR_ID)
    expect(redis.del).toHaveBeenCalledWith(`atc:vitals:character:${CHAR_ID}`)
  })

  it('extends TTL on refresh', async () => {
    const redis = makeRedis()
    const cache = new VitalsCache(redis as never)
    await cache.refresh(CHAR_ID)
    expect(redis.expire).toHaveBeenCalledWith(`atc:vitals:character:${CHAR_ID}`, 60)
  })
})
