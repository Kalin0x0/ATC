import { describe, it, expect, vi } from 'vitest'
import { AtcPluginScopedEventBus } from '@atc/plugin-registry'
import { AtcEventBus } from '@atc/events'
import { AtcPermissionDeniedError } from '@atc/plugin-runtime'

function makeEventBus() {
  return new AtcEventBus({ metricsEnabled: false })
}

// ── subscribe ──────────────────────────────────────────────────────────────────

describe('AtcPluginScopedEventBus — subscribe', () => {
  it('registers a handler and receives events', async () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    const received: unknown[] = []
    scoped.subscribe('p1', ['events.subscribe'], 'test:event', (p) => received.push(p))
    await bus.emit('test:event', { data: 42 })
    expect(received).toHaveLength(1)
    expect((received[0] as { data: number }).data).toBe(42)
  })

  it('throws AtcPermissionDeniedError without events.subscribe capability', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    expect(() =>
      scoped.subscribe('p1', ['inventory.read'], 'test:event', vi.fn()),
    ).toThrow(AtcPermissionDeniedError)
  })

  it('tracks subscription count per plugin', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    scoped.subscribe('p1', ['events.subscribe'], 'ev1', vi.fn())
    scoped.subscribe('p1', ['events.subscribe'], 'ev2', vi.fn())
    expect(scoped.getSubscriptionCount('p1')).toBe(2)
  })

  it('returns 0 for plugin with no subscriptions', () => {
    const scoped = new AtcPluginScopedEventBus(makeEventBus())
    expect(scoped.getSubscriptionCount('ghost')).toBe(0)
  })

  it('multiple plugins tracked independently', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    scoped.subscribe('p1', ['events.subscribe'], 'ev1', vi.fn())
    scoped.subscribe('p2', ['events.subscribe'], 'ev2', vi.fn())
    scoped.subscribe('p2', ['events.subscribe'], 'ev3', vi.fn())
    expect(scoped.getSubscriptionCount('p1')).toBe(1)
    expect(scoped.getSubscriptionCount('p2')).toBe(2)
  })
})

// ── publish ────────────────────────────────────────────────────────────────────

describe('AtcPluginScopedEventBus — publish', () => {
  it('emits event to bus listeners', async () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    const received: unknown[] = []
    bus.on('my:event', (p) => received.push(p))
    await scoped.publish('p1', ['events.publish'], 'my:event', { val: 99 })
    expect(received).toHaveLength(1)
    expect((received[0] as { val: number }).val).toBe(99)
  })

  it('throws AtcPermissionDeniedError without events.publish capability', async () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    await expect(
      scoped.publish('p1', ['inventory.read'], 'my:event', {}),
    ).rejects.toThrow(AtcPermissionDeniedError)
  })

  it('publish does not require events.subscribe', async () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    await expect(
      scoped.publish('p1', ['events.publish'], 'my:event', {}),
    ).resolves.toBeUndefined()
  })
})

// ── cleanup ────────────────────────────────────────────────────────────────────

describe('AtcPluginScopedEventBus — cleanup', () => {
  it('removes all handlers for plugin and returns count', async () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    const received: unknown[] = []
    scoped.subscribe('p1', ['events.subscribe'], 'ev1', (p) => received.push(p))
    scoped.subscribe('p1', ['events.subscribe'], 'ev2', (p) => received.push(p))
    const count = scoped.cleanup('p1')
    expect(count).toBe(2)
    await bus.emit('ev1', {})
    await bus.emit('ev2', {})
    expect(received).toHaveLength(0)
  })

  it('returns 0 for unknown plugin', () => {
    const scoped = new AtcPluginScopedEventBus(makeEventBus())
    expect(scoped.cleanup('ghost')).toBe(0)
  })

  it('subscription count drops to 0 after cleanup', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    scoped.subscribe('p1', ['events.subscribe'], 'ev1', vi.fn())
    scoped.cleanup('p1')
    expect(scoped.getSubscriptionCount('p1')).toBe(0)
  })

  it('cleanup is idempotent (second call returns 0)', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    scoped.subscribe('p1', ['events.subscribe'], 'ev1', vi.fn())
    scoped.cleanup('p1')
    expect(scoped.cleanup('p1')).toBe(0)
  })

  it('only removes handlers for target plugin, not others', async () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    const received: unknown[] = []
    scoped.subscribe('p1', ['events.subscribe'], 'shared:event', vi.fn())
    scoped.subscribe('p2', ['events.subscribe'], 'shared:event', (p) => received.push(p))
    scoped.cleanup('p1')
    await bus.emit('shared:event', { x: 1 })
    expect(received).toHaveLength(1)
  })
})

// ── getAllSubscriptionCounts ───────────────────────────────────────────────────

describe('AtcPluginScopedEventBus — getAllSubscriptionCounts', () => {
  it('returns correct counts for all plugins', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    scoped.subscribe('p1', ['events.subscribe'], 'e1', vi.fn())
    scoped.subscribe('p1', ['events.subscribe'], 'e2', vi.fn())
    scoped.subscribe('p2', ['events.subscribe'], 'e3', vi.fn())
    const counts = scoped.getAllSubscriptionCounts()
    expect(counts['p1']).toBe(2)
    expect(counts['p2']).toBe(1)
  })

  it('returns empty object when no subscriptions', () => {
    const scoped = new AtcPluginScopedEventBus(makeEventBus())
    expect(scoped.getAllSubscriptionCounts()).toEqual({})
  })

  it('does not include cleaned-up plugins', () => {
    const bus = makeEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)
    scoped.subscribe('p1', ['events.subscribe'], 'e1', vi.fn())
    scoped.cleanup('p1')
    expect(scoped.getAllSubscriptionCounts()).toEqual({})
  })
})
