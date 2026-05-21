import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatusEffectCache } from '@atc/cache'
import type { AtcStatusEffect } from '@atc/shared-types'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'
const HASH_KEY = `atc:status:character:${CHAR_ID}`

function makeEffect(overrides: Partial<AtcStatusEffect> = {}): AtcStatusEffect {
  return {
    id: `status:${CHAR_ID}:fatigue`,
    characterId: CHAR_ID,
    type: 'fatigue',
    severity: 'medium',
    source: 'vitals',
    reason: 'Stamina critically low',
    startedAt: new Date().toISOString(),
    expiresAt: null,
    ...overrides,
  }
}

function makePipeline() {
  return {
    hset:   vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec:   vi.fn().mockResolvedValue([]),
  }
}

function makeRedis(overrides: Record<string, unknown> = {}) {
  const _pipeline = makePipeline()
  return {
    hgetall:  vi.fn().mockResolvedValue(null),
    hdel:     vi.fn().mockResolvedValue(1),
    del:      vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue(_pipeline),
    _pipeline,
    ...overrides,
  }
}

// ── apply & list ──────────────────────────────────────────────────────────────

describe('StatusEffectCache — apply', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('stores the effect as JSON in the correct hash field', async () => {
    const redis = makeRedis()
    const cache = new StatusEffectCache(redis as never)
    const effect = makeEffect()
    await cache.apply(CHAR_ID, effect)
    expect(redis._pipeline.hset).toHaveBeenCalledWith(HASH_KEY, 'fatigue', JSON.stringify(effect))
  })

  it('sets a 24-hour rolling TTL on the hash key', async () => {
    const redis = makeRedis()
    const cache = new StatusEffectCache(redis as never)
    await cache.apply(CHAR_ID, makeEffect())
    expect(redis._pipeline.expire).toHaveBeenCalledWith(HASH_KEY, 86400)
  })

  it('hset and expire are sent in a single pipeline (atomic)', async () => {
    const redis = makeRedis()
    const cache = new StatusEffectCache(redis as never)
    await cache.apply(CHAR_ID, makeEffect())
    expect(redis.pipeline).toHaveBeenCalledOnce()
    expect(redis._pipeline.exec).toHaveBeenCalledOnce()
  })

  it('second apply for same type replaces the first (idempotent upsert)', async () => {
    const redis = makeRedis()
    const cache = new StatusEffectCache(redis as never)
    const first  = makeEffect({ reason: 'first' })
    const second = makeEffect({ reason: 'second' })
    await cache.apply(CHAR_ID, first)
    await cache.apply(CHAR_ID, second)
    expect(redis._pipeline.hset).toHaveBeenCalledTimes(2)
    expect(redis._pipeline.hset).toHaveBeenLastCalledWith(HASH_KEY, 'fatigue', JSON.stringify(second))
  })
})

describe('StatusEffectCache — list', () => {
  it('returns empty array when no effects exist (null from hgetall)', async () => {
    const redis = makeRedis({ hgetall: vi.fn().mockResolvedValue(null) })
    const cache = new StatusEffectCache(redis as never)
    expect(await cache.list(CHAR_ID)).toEqual([])
  })

  it('returns empty array when hash is empty', async () => {
    const redis = makeRedis({ hgetall: vi.fn().mockResolvedValue({}) })
    const cache = new StatusEffectCache(redis as never)
    expect(await cache.list(CHAR_ID)).toEqual([])
  })

  it('returns active effects from the hash', async () => {
    const effect = makeEffect()
    const redis = makeRedis({ hgetall: vi.fn().mockResolvedValue({ fatigue: JSON.stringify(effect) }) })
    const cache = new StatusEffectCache(redis as never)
    const result = await cache.list(CHAR_ID)
    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe('fatigue')
  })

  it('prunes expired effects on read and does not return them', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const expiredEffect = makeEffect({ expiresAt: pastDate })
    const redis = makeRedis({
      hgetall: vi.fn().mockResolvedValue({ fatigue: JSON.stringify(expiredEffect) }),
    })
    const cache = new StatusEffectCache(redis as never)
    const result = await cache.list(CHAR_ID)
    expect(result).toHaveLength(0)
    expect(redis.hdel).toHaveBeenCalledWith(HASH_KEY, 'fatigue')
  })

  it('keeps effects that have not yet expired', async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString()
    const activeEffect = makeEffect({ expiresAt: futureDate })
    const redis = makeRedis({
      hgetall: vi.fn().mockResolvedValue({ fatigue: JSON.stringify(activeEffect) }),
    })
    const cache = new StatusEffectCache(redis as never)
    const result = await cache.list(CHAR_ID)
    expect(result).toHaveLength(1)
    expect(redis.hdel).not.toHaveBeenCalled()
  })

  it('prunes corrupt (non-JSON) hash fields and does not return them', async () => {
    const redis = makeRedis({ hgetall: vi.fn().mockResolvedValue({ fatigue: 'not-json' }) })
    const cache = new StatusEffectCache(redis as never)
    const result = await cache.list(CHAR_ID)
    expect(result).toHaveLength(0)
    expect(redis.hdel).toHaveBeenCalledWith(HASH_KEY, 'fatigue')
  })

  it('returns [] (safe empty) when Redis hgetall throws', async () => {
    const redis = makeRedis({ hgetall: vi.fn().mockRejectedValue(new Error('Redis down')) })
    const cache = new StatusEffectCache(redis as never)
    const result = await cache.list(CHAR_ID)
    expect(result).toEqual([])
  })
})

// ── clear ─────────────────────────────────────────────────────────────────────

describe('StatusEffectCache — clear', () => {
  it('deletes a single type field from the hash', async () => {
    const redis = makeRedis()
    const cache = new StatusEffectCache(redis as never)
    await cache.clear(CHAR_ID, 'fatigue')
    expect(redis.hdel).toHaveBeenCalledWith(HASH_KEY, 'fatigue')
  })
})

// ── clearAll ──────────────────────────────────────────────────────────────────

describe('StatusEffectCache — clearAll', () => {
  it('deletes the entire hash key', async () => {
    const redis = makeRedis()
    const cache = new StatusEffectCache(redis as never)
    await cache.clearAll(CHAR_ID)
    expect(redis.del).toHaveBeenCalledWith(HASH_KEY)
  })
})

// ── pruneExpired ──────────────────────────────────────────────────────────────

describe('StatusEffectCache — pruneExpired', () => {
  it('returns 0 when hash is null', async () => {
    const redis = makeRedis({ hgetall: vi.fn().mockResolvedValue(null) })
    const cache = new StatusEffectCache(redis as never)
    expect(await cache.pruneExpired(CHAR_ID)).toBe(0)
  })

  it('returns 0 when Redis throws', async () => {
    const redis = makeRedis({ hgetall: vi.fn().mockRejectedValue(new Error('Redis down')) })
    const cache = new StatusEffectCache(redis as never)
    expect(await cache.pruneExpired(CHAR_ID)).toBe(0)
  })

  it('removes expired entries and returns count', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const expiredEffect = makeEffect({ expiresAt: pastDate })
    const activeEffect  = makeEffect({ type: 'stressed', id: `status:${CHAR_ID}:stressed`, expiresAt: null })
    const redis = makeRedis({
      hgetall: vi.fn().mockResolvedValue({
        fatigue:  JSON.stringify(expiredEffect),
        stressed: JSON.stringify(activeEffect),
      }),
    })
    const cache = new StatusEffectCache(redis as never)
    const pruned = await cache.pruneExpired(CHAR_ID)
    expect(pruned).toBe(1)
    expect(redis.hdel).toHaveBeenCalledWith(HASH_KEY, 'fatigue')
  })
})
