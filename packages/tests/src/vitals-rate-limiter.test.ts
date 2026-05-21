import { describe, it, expect, vi } from 'vitest'
import { RateLimiter } from '@atc/cache'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

function makeRedis(overrides: Partial<{
  incr: ReturnType<typeof vi.fn>
  expire: ReturnType<typeof vi.fn>
  ttl: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    incr:   overrides.incr   ?? vi.fn().mockResolvedValue(1),
    expire: overrides.expire ?? vi.fn().mockResolvedValue(1),
    ttl:    overrides.ttl    ?? vi.fn().mockResolvedValue(60),
    del:    overrides.del    ?? vi.fn().mockResolvedValue(1),
  }
}

describe('RateLimiter — allowed requests', () => {
  it('allows when count is under limit', async () => {
    const redis = makeRedis({ incr: vi.fn().mockResolvedValue(1) })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    const result = await rl.check(CHAR_ID)
    expect(result.allowed).toBe(true)
    expect(result.retryAfterSeconds).toBeUndefined()
  })

  it('allows exactly at the limit', async () => {
    const redis = makeRedis({ incr: vi.fn().mockResolvedValue(60) })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    const result = await rl.check(CHAR_ID)
    expect(result.allowed).toBe(true)
  })

  it('calls expire only on first request (count === 1)', async () => {
    const expire = vi.fn().mockResolvedValue(1)
    const redis = makeRedis({ incr: vi.fn().mockResolvedValue(1), expire })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    await rl.check(CHAR_ID)
    expect(expire).toHaveBeenCalledWith(`test:${CHAR_ID}`, 60)
  })

  it('does not call expire when count > 1', async () => {
    const expire = vi.fn().mockResolvedValue(1)
    const redis = makeRedis({ incr: vi.fn().mockResolvedValue(5), expire })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    await rl.check(CHAR_ID)
    expect(expire).not.toHaveBeenCalled()
  })
})

describe('RateLimiter — rate exceeded', () => {
  it('blocks when count exceeds max', async () => {
    const redis = makeRedis({
      incr: vi.fn().mockResolvedValue(61),
      ttl: vi.fn().mockResolvedValue(45),
    })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    const result = await rl.check(CHAR_ID)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBe(45)
  })

  it('uses windowSeconds as fallback when ttl returns -1', async () => {
    const redis = makeRedis({
      incr: vi.fn().mockResolvedValue(61),
      ttl: vi.fn().mockResolvedValue(-1),
    })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    const result = await rl.check(CHAR_ID)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBe(60)
  })

  it('uses correct rate-limit key format', async () => {
    const incr = vi.fn().mockResolvedValue(1)
    const redis = makeRedis({ incr })
    const rl = new RateLimiter(redis as never, {
      prefix: 'atc:ratelimit:vitals:mutation',
      max: 60,
      windowSeconds: 60,
    })
    await rl.check(CHAR_ID)
    expect(incr).toHaveBeenCalledWith(`atc:ratelimit:vitals:mutation:${CHAR_ID}`)
  })
})

describe('RateLimiter — Redis failure (fail-open)', () => {
  it('allows the request when Redis throws on incr', async () => {
    const redis = makeRedis({ incr: vi.fn().mockRejectedValue(new Error('Redis down')) })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    const result = await rl.check(CHAR_ID)
    expect(result.allowed).toBe(true)
  })

  it('does not throw when Redis is unavailable', async () => {
    const redis = makeRedis({ incr: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    await expect(rl.check(CHAR_ID)).resolves.not.toThrow()
  })
})

describe('RateLimiter — reset()', () => {
  it('calls redis.del with the correct key', async () => {
    const del = vi.fn().mockResolvedValue(1)
    const redis = makeRedis({ del })
    const rl = new RateLimiter(redis as never, { prefix: 'atc:ratelimit:vitals:mutation', max: 60, windowSeconds: 60 })
    await rl.reset(CHAR_ID)
    expect(del).toHaveBeenCalledWith(`atc:ratelimit:vitals:mutation:${CHAR_ID}`)
  })

  it('reset() does not throw when Redis fails', async () => {
    const redis = makeRedis({ del: vi.fn().mockRejectedValue(new Error('Redis down')) })
    const rl = new RateLimiter(redis as never, { prefix: 'test', max: 60, windowSeconds: 60 })
    await expect(rl.reset(CHAR_ID)).resolves.toBeUndefined()
  })
})
