import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcEventBus } from '@atc/events'
import { registerVitalsThresholdEvaluator } from './status-effects/evaluator.js'
import type { AtcStatusEffect } from '@atc/shared-types'

const CHAR_ID = '01HZ9XVFG3QKJM5N8P2R4T6WYZ'

function makeCache() {
  return {
    apply: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    list:  vi.fn().mockResolvedValue([]),
  }
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

function makeVitals(overrides: Record<string, number> = {}) {
  return {
    health: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    stress: 0,
    armor: 0,
    ...overrides,
  }
}

async function emitVitals(bus: AtcEventBus, vitals: Record<string, number>) {
  await bus.emit('atc:vitals:changed', {
    characterId: CHAR_ID,
    source: 'api',
    timestamp: new Date().toISOString(),
    vitals,
  })
  await new Promise((r) => setTimeout(r, 0))
}

// ── hunger threshold (starving) ───────────────────────────────────────────────

describe('vitals evaluator — hunger → starving', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('applies starving effect when hunger < 20', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ hunger: 15 }))

    expect(cache.apply).toHaveBeenCalledWith(
      CHAR_ID,
      expect.objectContaining<Partial<AtcStatusEffect>>({ type: 'starving', source: 'vitals' }),
    )
  })

  it('clears starving effect when hunger >= 25', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ hunger: 25 }))

    expect(cache.clear).toHaveBeenCalledWith(CHAR_ID, 'starving')
    expect(cache.apply).not.toHaveBeenCalledWith(CHAR_ID, expect.objectContaining({ type: 'starving' }))
  })

  it('does not apply or clear when hunger is in the 20–24 band', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ hunger: 22 }))

    expect(cache.apply).not.toHaveBeenCalledWith(CHAR_ID, expect.objectContaining({ type: 'starving' }))
    expect(cache.clear).not.toHaveBeenCalledWith(CHAR_ID, 'starving')
  })
})

// ── thirst threshold (dehydrated) ─────────────────────────────────────────────

describe('vitals evaluator — thirst → dehydrated', () => {
  it('applies dehydrated effect when thirst < 20', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ thirst: 10 }))

    expect(cache.apply).toHaveBeenCalledWith(
      CHAR_ID,
      expect.objectContaining({ type: 'dehydrated', source: 'vitals' }),
    )
  })

  it('clears dehydrated effect when thirst >= 25', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ thirst: 30 }))

    expect(cache.clear).toHaveBeenCalledWith(CHAR_ID, 'dehydrated')
  })
})

// ── stamina threshold (fatigue) ───────────────────────────────────────────────

describe('vitals evaluator — stamina → fatigue', () => {
  it('applies fatigue effect when stamina < 20', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ stamina: 15 }))

    expect(cache.apply).toHaveBeenCalledWith(
      CHAR_ID,
      expect.objectContaining({ type: 'fatigue', severity: 'medium' }),
    )
  })

  it('clears fatigue effect when stamina >= 30', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ stamina: 30 }))

    expect(cache.clear).toHaveBeenCalledWith(CHAR_ID, 'fatigue')
  })
})

// ── stress threshold (stressed) ───────────────────────────────────────────────

describe('vitals evaluator — stress → stressed', () => {
  it('applies stressed effect when stress > 80', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ stress: 85 }))

    expect(cache.apply).toHaveBeenCalledWith(
      CHAR_ID,
      expect.objectContaining({ type: 'stressed', severity: 'high' }),
    )
  })

  it('clears stressed effect when stress <= 70', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ stress: 70 }))

    expect(cache.clear).toHaveBeenCalledWith(CHAR_ID, 'stressed')
  })

  it('does not apply stressed when stress is exactly 80', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ stress: 80 }))

    expect(cache.apply).not.toHaveBeenCalledWith(CHAR_ID, expect.objectContaining({ type: 'stressed' }))
  })
})

// ── effect ID format ──────────────────────────────────────────────────────────

describe('vitals evaluator — effect ID is deterministic', () => {
  it('applies effect with id = status:{characterId}:{type}', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ hunger: 10 }))

    const applyCalls = (cache.apply as ReturnType<typeof vi.fn>).mock.calls as unknown as [string, AtcStatusEffect][]
    const starvingCall = applyCalls.find(([, e]) => e.type === 'starving')
    expect(starvingCall).toBeDefined()
    expect(starvingCall![1].id).toBe(`status:${CHAR_ID}:starving`)
  })
})

// ── expiresAt is null ─────────────────────────────────────────────────────────

describe('vitals evaluator — expiresAt is null for all applied effects', () => {
  it('does not set expiresAt on vitals-triggered effects', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ hunger: 5, thirst: 5, stamina: 5, stress: 90 }))

    const applyCalls = (cache.apply as ReturnType<typeof vi.fn>).mock.calls as unknown as [string, AtcStatusEffect][]
    for (const [, effect] of applyCalls) {
      expect(effect.expiresAt).toBeNull()
    }
  })
})

// ── idempotency ───────────────────────────────────────────────────────────────

describe('vitals evaluator — idempotency on repeated events', () => {
  it('calls apply twice for the same type on two events (cache enforces upsert)', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    registerVitalsThresholdEvaluator(bus, cache as never, makeLogger() as never)

    await emitVitals(bus, makeVitals({ hunger: 5 }))
    await emitVitals(bus, makeVitals({ hunger: 5 }))

    const allCalls = (cache.apply as ReturnType<typeof vi.fn>).mock.calls as unknown as [string, AtcStatusEffect][]
    const starvingCalls = allCalls.filter(([, e]) => e.type === 'starving')
    expect(starvingCalls).toHaveLength(2)
  })
})

// ── error isolation ───────────────────────────────────────────────────────────

describe('vitals evaluator — cache errors are non-fatal', () => {
  it('logs a warning and does not throw when cache.apply rejects', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    ;(cache.apply as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis down'))
    const logger = makeLogger()
    registerVitalsThresholdEvaluator(bus, cache as never, logger as never)

    await emitVitals(bus, makeVitals({ hunger: 5 }))

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'vitals threshold evaluator error',
    )
  })
})

// ── nil guard ─────────────────────────────────────────────────────────────────

describe('vitals evaluator — malformed event (missing vitals)', () => {
  it('does not apply or clear anything and logs a warning when vitals is missing', async () => {
    const bus = new AtcEventBus()
    const cache = makeCache()
    const logger = makeLogger()
    registerVitalsThresholdEvaluator(bus, cache as never, logger as never)

    await bus.emit('atc:vitals:changed', {
      characterId: CHAR_ID,
      source: 'api',
      timestamp: new Date().toISOString(),
      // vitals intentionally omitted
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(cache.apply).not.toHaveBeenCalled()
    expect(cache.clear).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: CHAR_ID }),
      'vitals threshold evaluator: missing or invalid vitals payload',
    )
  })
})
