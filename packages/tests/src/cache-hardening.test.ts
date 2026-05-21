import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionCache } from '@atc/cache'
import type { RedisClient } from '@atc/cache'

function makeMockRedis(overrides: Partial<Record<string, unknown>> = {}): RedisClient {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as RedisClient
}

describe('SessionCache.get — JSON parse guard', () => {
  it('returns null and evicts on corrupt cache entry', async () => {
    const delMock = vi.fn().mockResolvedValue(1)
    const redis = makeMockRedis({
      get: vi.fn().mockResolvedValue('{ this is not valid json }'),
      del: delMock,
    })
    const cache = new SessionCache(redis)
    const result = await cache.get(1)
    expect(result).toBeNull()
    expect(delMock).toHaveBeenCalled()
  })

  it('returns null for Redis null response', async () => {
    const redis = makeMockRedis({ get: vi.fn().mockResolvedValue(null) })
    const cache = new SessionCache(redis)
    expect(await cache.get(1)).toBeNull()
  })

  it('returns parsed session on valid JSON', async () => {
    const session = {
      sessionId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
      source: 3,
      language: 'en',
      state: 'active',
    }
    const redis = makeMockRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(session)) })
    const cache = new SessionCache(redis)
    const result = await cache.get(3)
    expect(result).toEqual(session)
  })
})

describe('SessionCache.set', () => {
  it('calls setex with correct key and TTL', async () => {
    const setexMock = vi.fn().mockResolvedValue('OK')
    const redis = makeMockRedis({ setex: setexMock })
    const cache = new SessionCache(redis)
    await cache.set({
      sessionId: '01HZ9XVFG3QKJM5N8P2R4T6WYZ',
      accountId: '01HZ9XVFG3QKJM5N8P2R4T6WXZ',
      source: 7,
      language: 'de',
      state: 'connecting',
    })
    expect(setexMock).toHaveBeenCalledWith(
      'atc:session:source:7',
      300,
      expect.stringContaining('01HZ9XVFG3QKJM5N8P2R4T6WYZ')
    )
  })
})

describe('SessionCache.del', () => {
  it('deletes the correct key', async () => {
    const delMock = vi.fn().mockResolvedValue(1)
    const redis = makeMockRedis({ del: delMock })
    const cache = new SessionCache(redis)
    await cache.del(9)
    expect(delMock).toHaveBeenCalledWith('atc:session:source:9')
  })
})

describe('SessionCache key namespacing', () => {
  it('uses atc:session:source: prefix', async () => {
    const getMock = vi.fn().mockResolvedValue(null)
    const redis = makeMockRedis({ get: getMock })
    const cache = new SessionCache(redis)
    await cache.get(42)
    expect(getMock).toHaveBeenCalledWith('atc:session:source:42')
  })

  it('different sources use different keys', async () => {
    const getMock = vi.fn().mockResolvedValue(null)
    const redis = makeMockRedis({ get: getMock })
    const cache = new SessionCache(redis)
    await cache.get(1)
    await cache.get(2)
    const calls = getMock.mock.calls as string[][]
    expect(calls[0]?.[0]).toBe('atc:session:source:1')
    expect(calls[1]?.[0]).toBe('atc:session:source:2')
  })
})

describe('SessionCache Redis failure resilience', () => {
  it('get propagates Redis error (caller decides resilience)', async () => {
    const redis = makeMockRedis({
      get: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    })
    const cache = new SessionCache(redis)
    await expect(cache.get(1)).rejects.toThrow('ECONNREFUSED')
  })

  it('corrupt entry del failure is silently swallowed', async () => {
    const redis = makeMockRedis({
      get: vi.fn().mockResolvedValue('corrupt json{{{'),
      del: vi.fn().mockRejectedValue(new Error('Redis down')),
    })
    const cache = new SessionCache(redis)
    // Should not throw even if del fails during corrupt-entry cleanup
    await expect(cache.get(1)).resolves.toBeNull()
  })
})
