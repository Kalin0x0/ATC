import { describe, it, expect, vi } from 'vitest'
import { AtcEventBus } from '@atc/events'

// ── metrics enabled (default) ─────────────────────────────────────────────────

describe('AtcEventBus metrics — counters', () => {
  it('emittedTotal increments on each emit()', async () => {
    const bus = new AtcEventBus()
    await bus.emit('atc:test', {})
    await bus.emit('atc:test', {})
    expect(bus.getMetrics().emittedTotal).toBe(2)
  })

  it('handledTotal increments per successful handler invocation', async () => {
    const bus = new AtcEventBus()
    bus.on('atc:test', vi.fn())
    bus.on('atc:test', vi.fn())
    await bus.emit('atc:test', {})
    expect(bus.getMetrics().handledTotal).toBe(2)
  })

  it('failedTotal increments when a handler throws', async () => {
    const bus = new AtcEventBus()
    bus.on('atc:test', () => { throw new Error('boom') })
    bus.on('atc:test', vi.fn())
    await bus.emit('atc:test', {})
    expect(bus.getMetrics().failedTotal).toBe(1)
    expect(bus.getMetrics().handledTotal).toBe(1)
  })

  it('emit with no handlers increments emittedTotal but not handledTotal', async () => {
    const bus = new AtcEventBus()
    await bus.emit('atc:no:handlers', {})
    const m = bus.getMetrics()
    expect(m.emittedTotal).toBe(1)
    expect(m.handledTotal).toBe(0)
    expect(m.failedTotal).toBe(0)
  })
})

describe('AtcEventBus metrics — activeSubscribers', () => {
  it('activeSubscribers reflects total registered handlers across all events', () => {
    const bus = new AtcEventBus()
    bus.on('atc:a', vi.fn())
    bus.on('atc:a', vi.fn())
    bus.on('atc:b', vi.fn())
    expect(bus.getMetrics().activeSubscribers).toBe(3)
  })

  it('activeSubscribers decreases when handlers are removed', () => {
    const bus = new AtcEventBus()
    const h = vi.fn()
    bus.on('atc:a', h)
    bus.on('atc:a', vi.fn())
    bus.off('atc:a', h)
    expect(bus.getMetrics().activeSubscribers).toBe(1)
  })

  it('activeSubscribers is 0 for a fresh bus', () => {
    const bus = new AtcEventBus()
    expect(bus.getMetrics().activeSubscribers).toBe(0)
  })
})

describe('AtcEventBus metrics — timing', () => {
  it('avgDurationMs is 0 when nothing has been emitted', () => {
    const bus = new AtcEventBus()
    expect(bus.getMetrics().avgDurationMs).toBe(0)
  })

  it('avgDurationMs is a non-negative number after emitting with handlers', async () => {
    const bus = new AtcEventBus()
    bus.on('atc:test', () => { /* sync */ })
    await bus.emit('atc:test', {})
    expect(bus.getMetrics().avgDurationMs).toBeGreaterThanOrEqual(0)
  })
})

// ── metrics disabled ──────────────────────────────────────────────────────────

describe('AtcEventBus metrics — disabled', () => {
  it('getMetrics() reports metricsEnabled: false when disabled', () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    expect(bus.getMetrics().metricsEnabled).toBe(false)
  })

  it('counters remain 0 when metrics are disabled', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    bus.on('atc:test', vi.fn())
    await bus.emit('atc:test', {})
    await bus.emit('atc:test', {})
    const m = bus.getMetrics()
    expect(m.emittedTotal).toBe(0)
    expect(m.handledTotal).toBe(0)
  })

  it('disabled metrics never crash emit()', async () => {
    const bus = new AtcEventBus({ metricsEnabled: false })
    await expect(bus.emit('atc:test', {})).resolves.toBeDefined()
  })
})

// ── metrics enabled flag ──────────────────────────────────────────────────────

describe('AtcEventBus metrics — metricsEnabled default', () => {
  it('new AtcEventBus() defaults to metricsEnabled: true', () => {
    const bus = new AtcEventBus()
    expect(bus.getMetrics().metricsEnabled).toBe(true)
  })

  it('metrics collection never throws even when handler rejects', async () => {
    const bus = new AtcEventBus({ metricsEnabled: true })
    bus.on('atc:test', async () => { throw new Error('async fail') })
    await expect(bus.emit('atc:test', {})).resolves.toBeDefined()
    expect(bus.getMetrics().failedTotal).toBe(1)
  })
})
