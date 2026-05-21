import { describe, it, expect, vi } from 'vitest'
import { createVitalsModifyHandler } from '@atc/runtime-items'
import { VitalsCache } from '@atc/cache'
import type { AtcCharacterVitals } from '@atc/shared-types'

// ── createVitalsModifyHandler — strict input validation (BUG-9-2) ─────────────

describe('createVitalsModifyHandler — strict input validation', () => {
  const CHAR_ID = 'char-001'

  function makeService() {
    return { mutate: vi.fn().mockResolvedValue({ characterId: CHAR_ID, health: 75 }) }
  }

  it('rejects unknown vital name', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'mana', mode: 'set', amount: 50 })
    expect(result.success).toBe(false)
  })

  it('rejects unknown mode', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'health', mode: 'add', amount: 10 })
    expect(result.success).toBe(false)
  })

  it('rejects NaN amount', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'health', mode: 'set', amount: NaN })
    expect(result.success).toBe(false)
  })

  it('rejects Infinity amount', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'health', mode: 'increment', amount: Infinity })
    expect(result.success).toBe(false)
  })

  it('rejects float amount (non-integer)', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'thirst', mode: 'increment', amount: 25.5 })
    expect(result.success).toBe(false)
  })

  it('rejects amount above 100', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'stamina', mode: 'set', amount: 101 })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', async () => {
    const handler = createVitalsModifyHandler(makeService())
    const result = await handler(CHAR_ID, 'item', { vital: 'health', mode: 'decrement', amount: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects vital as a number (type guard)', async () => {
    const service = makeService()
    const handler = createVitalsModifyHandler(service)
    const result = await handler(CHAR_ID, 'item', { vital: 42, mode: 'set', amount: 50 })
    expect(result.success).toBe(false)
    expect(service.mutate).not.toHaveBeenCalled()
  })

  it('rejects mode as a number (type guard)', async () => {
    const service = makeService()
    const handler = createVitalsModifyHandler(service)
    const result = await handler(CHAR_ID, 'item', { vital: 'health', mode: 1, amount: 50 })
    expect(result.success).toBe(false)
    expect(service.mutate).not.toHaveBeenCalled()
  })

  it('accepts all valid vitals', async () => {
    const VALID = ['health', 'hunger', 'thirst', 'stamina', 'stress', 'armor']
    for (const vital of VALID) {
      const service = makeService()
      const handler = createVitalsModifyHandler(service)
      const result = await handler(CHAR_ID, 'item', { vital, mode: 'set', amount: 50 })
      expect(result.success).toBe(true)
      expect(service.mutate).toHaveBeenCalledWith(CHAR_ID, vital, 'set', 50)
    }
  })

  it('accepts all valid modes', async () => {
    const VALID = ['set', 'increment', 'decrement']
    for (const mode of VALID) {
      const service = makeService()
      const handler = createVitalsModifyHandler(service)
      const result = await handler(CHAR_ID, 'item', { vital: 'health', mode, amount: 25 })
      expect(result.success).toBe(true)
    }
  })

  it('accepts boundary amounts 0 and 100', async () => {
    const service = makeService()
    const handler = createVitalsModifyHandler(service)
    const r0   = await handler(CHAR_ID, 'item', { vital: 'health', mode: 'set', amount: 0 })
    const r100 = await handler(CHAR_ID, 'item', { vital: 'health', mode: 'set', amount: 100 })
    expect(r0.success).toBe(true)
    expect(r100.success).toBe(true)
  })

  it('does not call mutate when validation fails', async () => {
    const service = makeService()
    const handler = createVitalsModifyHandler(service)
    await handler(CHAR_ID, 'item', { vital: 'invalid', mode: 'set', amount: 50 })
    await handler(CHAR_ID, 'item', { vital: 'health', mode: 'invalid', amount: 50 })
    await handler(CHAR_ID, 'item', { vital: 'health', mode: 'set', amount: 9999 })
    expect(service.mutate).not.toHaveBeenCalled()
  })
})

// ── VitalsCache — redis write failure is non-fatal (BUG-9-CACHE) ──────────────

describe('VitalsCache — set failure behavior', () => {
  const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

  function makeVitals(overrides: Partial<AtcCharacterVitals> = {}): AtcCharacterVitals {
    return {
      characterId: CHAR_ID,
      health: 100, hunger: 80, thirst: 60, stamina: 90, stress: 10, armor: 0,
      createdAt: new Date(), updatedAt: new Date(),
      ...overrides,
    }
  }

  it('set() propagates Redis error (caller must .catch())', async () => {
    const redis = {
      setex: vi.fn().mockRejectedValue(new Error('Redis down')),
      get:   vi.fn(),
      del:   vi.fn(),
      expire: vi.fn(),
    }
    const cache = new VitalsCache(redis as never)
    await expect(cache.set(makeVitals())).rejects.toThrow('Redis down')
  })

  it('set().catch() pattern does not propagate error (route-level pattern)', async () => {
    const redis = {
      setex: vi.fn().mockRejectedValue(new Error('Redis down')),
      get:   vi.fn(),
      del:   vi.fn(),
      expire: vi.fn(),
    }
    const cache = new VitalsCache(redis as never)
    // This is the pattern used in all vitals API routes — should not throw
    await expect(
      Promise.resolve(cache.set(makeVitals()).catch(() => undefined)),
    ).resolves.toBeUndefined()
  })
})

// ── VitalsCache — del() confirms key removed ─────────────────────────────────

describe('VitalsCache — del() for character deletion cleanup', () => {
  const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

  it('del() calls redis.del with the correct key', async () => {
    const redis = {
      del: vi.fn().mockResolvedValue(1),
      setex: vi.fn(), get: vi.fn(), expire: vi.fn(),
    }
    const cache = new VitalsCache(redis as never)
    await cache.del(CHAR_ID)
    expect(redis.del).toHaveBeenCalledWith(`atc:vitals:character:${CHAR_ID}`)
  })

  it('del() does not throw when key did not exist (returns 0)', async () => {
    const redis = {
      del: vi.fn().mockResolvedValue(0),
      setex: vi.fn(), get: vi.fn(), expire: vi.fn(),
    }
    const cache = new VitalsCache(redis as never)
    await expect(cache.del(CHAR_ID)).resolves.toBeUndefined()
  })
})
