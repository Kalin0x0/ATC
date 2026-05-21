import { describe, it, expect, beforeEach } from 'vitest'
import { AtcTelemetryService } from '@atc/telemetry'

let svc: AtcTelemetryService

beforeEach(() => {
  svc = new AtcTelemetryService()
})

// ── counter ───────────────────────────────────────────────────────────────────

describe('AtcTelemetryService — counter / increment', () => {
  it('counter() creates a metric with value 1 on first call', () => {
    svc.counter('atc_test_total')
    const m = svc.get('atc_test_total')
    expect(m).toBeDefined()
    expect(m!.value).toBe(1)
    expect(m!.kind).toBe('counter')
  })

  it('counter() increments existing metric on subsequent calls', () => {
    svc.counter('atc_test_total')
    svc.counter('atc_test_total')
    svc.counter('atc_test_total')
    expect(svc.get('atc_test_total')!.value).toBe(3)
  })

  it('increment() adds the specified amount', () => {
    svc.increment('atc_test_total', 5)
    svc.increment('atc_test_total', 3)
    expect(svc.get('atc_test_total')!.value).toBe(8)
  })

  it('metrics with different labels are tracked separately', () => {
    svc.counter('atc_eventbus_emitted_total', { event: 'vitals' })
    svc.counter('atc_eventbus_emitted_total', { event: 'status' })
    svc.counter('atc_eventbus_emitted_total', { event: 'vitals' })
    expect(svc.get('atc_eventbus_emitted_total', { event: 'vitals' })!.value).toBe(2)
    expect(svc.get('atc_eventbus_emitted_total', { event: 'status' })!.value).toBe(1)
  })
})

// ── gauge ─────────────────────────────────────────────────────────────────────

describe('AtcTelemetryService — gauge', () => {
  it('gauge() sets the value directly (not accumulated)', () => {
    svc.gauge('atc_status_effects_active', 5)
    svc.gauge('atc_status_effects_active', 3)
    expect(svc.get('atc_status_effects_active')!.value).toBe(3)
    expect(svc.get('atc_status_effects_active')!.kind).toBe('gauge')
  })
})

// ── histogram / observe ───────────────────────────────────────────────────────

describe('AtcTelemetryService — histogram / observe', () => {
  it('observe() records a value with kind histogram', () => {
    svc.observe('atc_handler_duration_ms', 42.5)
    const m = svc.get('atc_handler_duration_ms')
    expect(m).toBeDefined()
    expect(m!.kind).toBe('histogram')
    expect(m!.value).toBe(42.5)
  })

  it('histogram() replaces the value on subsequent calls', () => {
    svc.histogram('atc_handler_duration_ms', 10)
    svc.histogram('atc_handler_duration_ms', 25)
    expect(svc.get('atc_handler_duration_ms')!.value).toBe(25)
  })
})

// ── snapshot immutability ─────────────────────────────────────────────────────

describe('AtcTelemetryService — snapshot', () => {
  it('snapshot() returns all registered metrics', () => {
    svc.counter('metric_a')
    svc.gauge('metric_b', 10)
    const snap = svc.snapshot()
    expect(snap.metrics).toHaveLength(2)
    expect(snap.capturedAt).toBeDefined()
  })

  it('mutating the snapshot does not affect internal state', () => {
    svc.counter('atc_test_total')
    const snap = svc.snapshot()
    const m = snap.metrics.find((x) => x.name === 'atc_test_total')!
    m.value = 999
    expect(svc.get('atc_test_total')!.value).toBe(1)
  })

  it('get() returns a copy — mutations do not affect internal state', () => {
    svc.counter('atc_test_total')
    const copy = svc.get('atc_test_total')!
    copy.value = 999
    expect(svc.get('atc_test_total')!.value).toBe(1)
  })
})

// ── reset / clear ─────────────────────────────────────────────────────────────

describe('AtcTelemetryService — reset / clear', () => {
  it('reset() removes a single metric', () => {
    svc.counter('metric_a')
    svc.counter('metric_b')
    svc.reset('metric_a')
    expect(svc.get('metric_a')).toBeUndefined()
    expect(svc.get('metric_b')).toBeDefined()
  })

  it('clear() removes all metrics', () => {
    svc.counter('metric_a')
    svc.gauge('metric_b', 5)
    svc.clear()
    expect(svc.snapshot().metrics).toHaveLength(0)
  })
})

// ── non-fatal on errors ───────────────────────────────────────────────────────

describe('AtcTelemetryService — non-fatal on errors', () => {
  it('get() returns undefined for unknown metric without throwing', () => {
    expect(svc.get('nonexistent')).toBeUndefined()
  })

  it('reset() on unknown metric does not throw', () => {
    expect(() => svc.reset('nonexistent')).not.toThrow()
  })
})
