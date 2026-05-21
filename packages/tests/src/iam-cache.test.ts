import { describe, it, expect, vi } from 'vitest'
import { AtcIamCache } from '@atc/iam'
import type { AtcPrincipal } from '@atc/shared-types'

function makePrincipal(id = 'u-1'): AtcPrincipal {
  return {
    id,
    type: 'account',
    roles: ['player'],
    permissions: ['player.read'],
    capabilities: [],
    denies: [],
  }
}

function makeRedis(overrides: {
  get?: (key: string) => Promise<string | null>
  set?: () => Promise<void>
  del?: () => Promise<void>
} = {}) {
  return {
    get: overrides.get ?? vi.fn().mockResolvedValue(null),
    set: overrides.set ?? vi.fn().mockResolvedValue('OK'),
    del: overrides.del ?? vi.fn().mockResolvedValue(1),
  }
}

describe('AtcIamCache — getPrincipal()', () => {
  it('returns null on cache miss', async () => {
    const cache = new AtcIamCache(makeRedis())
    expect(await cache.getPrincipal('u-1')).toBeNull()
  })

  it('returns parsed principal on cache hit', async () => {
    const principal = makePrincipal()
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(principal)) })
    const cache = new AtcIamCache(redis)
    const result = await cache.getPrincipal('u-1')
    expect(result).toEqual(principal)
  })

  it('increments cache_hits_total on hit', async () => {
    const telemetry = { increment: vi.fn() }
    const principal = makePrincipal()
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(principal)) })
    const cache = new AtcIamCache(redis, { telemetry })
    await cache.getPrincipal('u-1')
    expect(telemetry.increment).toHaveBeenCalledWith('security.cache_hits_total')
  })

  it('increments cache_misses_total on miss', async () => {
    const telemetry = { increment: vi.fn() }
    const cache = new AtcIamCache(makeRedis(), { telemetry })
    await cache.getPrincipal('u-1')
    expect(telemetry.increment).toHaveBeenCalledWith('security.cache_misses_total')
  })

  it('returns null and increments miss on Redis error (fail-open)', async () => {
    const telemetry = { increment: vi.fn() }
    const redis = makeRedis({ get: vi.fn().mockRejectedValue(new Error('redis down')) })
    const cache = new AtcIamCache(redis, { telemetry })
    expect(await cache.getPrincipal('u-1')).toBeNull()
    expect(telemetry.increment).toHaveBeenCalledWith('security.cache_misses_total')
  })

  it('uses correct Redis key', async () => {
    const redis = makeRedis()
    const cache = new AtcIamCache(redis)
    await cache.getPrincipal('abc')
    expect((redis.get as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('atc:iam:principal:abc')
  })
})

describe('AtcIamCache — setPrincipal()', () => {
  it('stores the principal as JSON', async () => {
    const redis = makeRedis()
    const cache = new AtcIamCache(redis, { ttlSeconds: 60 })
    const principal = makePrincipal()
    await cache.setPrincipal('u-1', principal)
    expect(redis.set).toHaveBeenCalledWith(
      'atc:iam:principal:u-1',
      JSON.stringify(principal),
      'EX',
      60,
    )
  })

  it('uses custom TTL when provided', async () => {
    const redis = makeRedis()
    const cache = new AtcIamCache(redis)
    await cache.setPrincipal('u-1', makePrincipal(), 120)
    const call = (redis.set as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[3]).toBe(120)
  })

  it('does not throw on Redis error (fail-open)', async () => {
    const redis = makeRedis({ set: vi.fn().mockRejectedValue(new Error('redis down')) as any })
    const cache = new AtcIamCache(redis)
    await expect(cache.setPrincipal('u-1', makePrincipal())).resolves.toBeUndefined()
  })
})

describe('AtcIamCache — invalidatePrincipal()', () => {
  it('deletes both principal and resolved keys', async () => {
    const redis = makeRedis()
    const cache = new AtcIamCache(redis)
    await cache.invalidatePrincipal('u-1')
    const delCalls = (redis.del as ReturnType<typeof vi.fn>).mock.calls.map((c: string[]) => c[0])
    expect(delCalls).toContain('atc:iam:principal:u-1')
    expect(delCalls).toContain('atc:iam:resolved:u-1')
  })

  it('does not throw on Redis error (fail-open)', async () => {
    const redis = makeRedis({ del: vi.fn().mockRejectedValue(new Error('down')) as any })
    const cache = new AtcIamCache(redis)
    await expect(cache.invalidatePrincipal('u-1')).resolves.toBeUndefined()
  })
})

describe('AtcIamCache — getResolved() / setResolved()', () => {
  it('returns null on resolved miss', async () => {
    const cache = new AtcIamCache(makeRedis())
    expect(await cache.getResolved('u-1')).toBeNull()
  })

  it('stores and retrieves resolved permissions', async () => {
    const data = { permissions: ['player.read'] as const, roles: ['player'] }
    const redis = makeRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(data)) })
    const cache = new AtcIamCache(redis)
    const result = await cache.getResolved('u-1')
    expect(result).toEqual(data)
  })

  it('uses correct key for resolved', async () => {
    const redis = makeRedis()
    const cache = new AtcIamCache(redis)
    await cache.getResolved('xyz')
    expect((redis.get as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('atc:iam:resolved:xyz')
  })
})
