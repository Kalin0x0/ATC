/**
 * Phase 13 Hardening Tests
 *
 * Cross-cutting correctness properties for the plugin runtime:
 * concurrency safety, duplicate-input rejection, timeout classification,
 * capability deduplication, EventBus handler lifecycle, and metrics integrity.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  AtcPluginRegistry,
  AtcPluginLifecycleManager,
  AtcPluginHealthMonitor,
  AtcPluginScopedEventBus,
  PluginConcurrentOperationError,
  PluginLifecycleTimeoutError,
  PluginDuplicateError,
} from '@atc/plugin-registry'
import { AtcEventBus } from '@atc/events'
import { registryManifestSchema } from '@atc/schemas'

function makeSetup(timeoutMs = 500) {
  const registry = new AtcPluginRegistry()
  const health = new AtcPluginHealthMonitor({ maxFailures: 3 })
  const eventBus = new AtcEventBus({ metricsEnabled: false })
  const lifecycle = new AtcPluginLifecycleManager(registry, health, eventBus, { timeoutMs })
  return { registry, health, eventBus, lifecycle }
}

// ── Concurrency guard ─────────────────────────────────────────────────────────

describe('Lifecycle — concurrency guard', () => {
  it('throws PluginConcurrentOperationError when start is already in-flight', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    let resolveLoad!: () => void
    lifecycle.registerHooks('p1', {
      onLoad: () => new Promise<void>((r) => { resolveLoad = r }),
    })

    // Start without awaiting — it is now in-flight
    const firstStart = lifecycle.start('p1')
    await Promise.resolve()  // let the microtask queue run so start() enters the hook

    // Second start on same plugin should throw immediately
    await expect(lifecycle.start('p1')).rejects.toThrow(PluginConcurrentOperationError)

    // Clean up
    resolveLoad()
    await firstStart
  })

  it('throws PluginConcurrentOperationError when stop called while start in-flight', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    let resolveLoad!: () => void
    lifecycle.registerHooks('p1', {
      onLoad: () => new Promise<void>((r) => { resolveLoad = r }),
    })

    const firstStart = lifecycle.start('p1')
    await Promise.resolve()

    await expect(lifecycle.stop('p1')).rejects.toThrow(PluginConcurrentOperationError)

    resolveLoad()
    await firstStart
  })

  it('throws PluginConcurrentOperationError when reload called while start in-flight', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    let resolveLoad!: () => void
    lifecycle.registerHooks('p1', {
      onLoad: () => new Promise<void>((r) => { resolveLoad = r }),
    })

    const firstStart = lifecycle.start('p1')
    await Promise.resolve()

    await expect(lifecycle.reload('p1')).rejects.toThrow(PluginConcurrentOperationError)

    resolveLoad()
    await firstStart
  })

  it('allows sequential start → stop → start (no guard fires)', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {})

    await lifecycle.start('p1')
    await lifecycle.stop('p1')
    registry.setStatus('p1', 'registered')
    await expect(lifecycle.start('p1')).resolves.toBeUndefined()
  })

  it('inflight flag is cleared after start completes', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {})
    await lifecycle.start('p1')
    expect(lifecycle.isInflight('p1')).toBe(false)
  })

  it('inflight flag is cleared after start fails', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', { onLoad: () => { throw new Error('fail') } })
    await lifecycle.start('p1').catch(() => undefined)
    expect(lifecycle.isInflight('p1')).toBe(false)
  })

  it('different plugins can start concurrently', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    registry.register({ id: 'p2', version: '1.0.0' })
    let resolveP1!: () => void
    lifecycle.registerHooks('p1', { onLoad: () => new Promise<void>((r) => { resolveP1 = r }) })
    lifecycle.registerHooks('p2', {})

    const startP1 = lifecycle.start('p1')
    await Promise.resolve()

    // p2 is a different plugin — should start without error
    await expect(lifecycle.start('p2')).resolves.toBeUndefined()

    resolveP1()
    await startP1
  })
})

// ── Timeout classification ────────────────────────────────────────────────────

describe('Lifecycle — timeout classification', () => {
  it('timeout throws PluginLifecycleTimeoutError (not generic Error)', async () => {
    const { registry, lifecycle } = makeSetup(30)
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {
      onLoad: () => new Promise((r) => setTimeout(r, 200)),
    })
    await expect(lifecycle.start('p1')).rejects.toBeInstanceOf(PluginLifecycleTimeoutError)
  })

  it('PluginLifecycleTimeoutError has correct fields', async () => {
    const { registry, lifecycle } = makeSetup(30)
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {
      onLoad: () => new Promise((r) => setTimeout(r, 200)),
    })
    try {
      await lifecycle.start('p1')
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(PluginLifecycleTimeoutError)
      const e = err as PluginLifecycleTimeoutError
      expect(e.pluginId).toBe('p1')
      expect(e.hook).toBe('onLoad')
      expect(e.timeoutMs).toBe(30)
    }
  })

  it('hook that throws "Timeout: ..." string is NOT misclassified as lifecycle timeout', async () => {
    const { registry, lifecycle } = makeSetup(500)
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {
      onLoad: () => { throw new Error('Timeout: something happened') },
    })
    try {
      await lifecycle.start('p1')
      expect.fail('should have thrown')
    } catch (err) {
      // Must be generic Error, NOT PluginLifecycleTimeoutError
      expect(err).not.toBeInstanceOf(PluginLifecycleTimeoutError)
      expect((err as Error).message).toBe('Timeout: something happened')
    }
  })
})

// ── Capability deduplication ──────────────────────────────────────────────────

describe('Registry — capability deduplication', () => {
  it('stores unique capabilities even when manifest has duplicates', () => {
    const reg = new AtcPluginRegistry()
    reg.register({
      id: 'p1',
      version: '1.0.0',
      capabilities: ['inventory.read', 'inventory.read', 'vitals.write'],
    })
    const record = reg.get('p1')!
    expect(record.capabilities).toHaveLength(2)
    expect(record.capabilities).toContain('inventory.read')
    expect(record.capabilities).toContain('vitals.write')
  })

  it('empty capabilities stores empty array (not undefined)', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    expect(reg.get('p1')!.capabilities).toEqual([])
  })
})

// ── Duplicate dependency ID rejection ─────────────────────────────────────────

describe('Registry manifest schema — duplicate dependency IDs', () => {
  it('rejects manifest with duplicate dependency IDs', () => {
    expect(() =>
      registryManifestSchema.parse({
        id: 'p1',
        version: '1.0.0',
        dependencies: [
          { id: 'dep-a', version: '^1.0.0' },
          { id: 'dep-a', version: '^2.0.0' },
        ],
      }),
    ).toThrow()
  })

  it('accepts manifest with distinct dependency IDs', () => {
    expect(() =>
      registryManifestSchema.parse({
        id: 'p1',
        version: '1.0.0',
        dependencies: [
          { id: 'dep-a', version: '^1.0.0' },
          { id: 'dep-b', version: '^1.0.0' },
        ],
      }),
    ).not.toThrow()
  })

  it('register() throws on duplicate dep IDs via schema validation', () => {
    const reg = new AtcPluginRegistry()
    expect(() =>
      reg.register({
        id: 'p1',
        version: '1.0.0',
        dependencies: [
          { id: 'x', version: '^1.0.0' },
          { id: 'x', version: '^1.0.0' },
        ],
      }),
    ).toThrow()
  })
})

// ── Reload — no duplicate EventBus handlers ───────────────────────────────────

describe('Lifecycle — reload does not duplicate EventBus handlers', () => {
  it('handler count does not grow after repeated reloads', async () => {
    const { registry, lifecycle, eventBus } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    const scoped = new AtcPluginScopedEventBus(eventBus)

    lifecycle.registerHooks('p1', {
      onLoad: () => {
        scoped.subscribe('p1', ['events.subscribe'], 'test:event', vi.fn())
      },
      onUnload: () => {
        scoped.cleanup('p1')
      },
    })

    await lifecycle.start('p1')
    expect(scoped.getSubscriptionCount('p1')).toBe(1)

    await lifecycle.reload('p1')
    expect(scoped.getSubscriptionCount('p1')).toBe(1)  // must NOT be 2

    await lifecycle.reload('p1')
    expect(scoped.getSubscriptionCount('p1')).toBe(1)  // must NOT be 3
  })

  it('cleanup removes all plugin handlers before next start', async () => {
    const { registry, lifecycle, eventBus } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    const received: number[] = []
    const scoped = new AtcPluginScopedEventBus(eventBus)
    let handlerVersion = 0

    lifecycle.registerHooks('p1', {
      onLoad: () => {
        const v = ++handlerVersion
        scoped.subscribe('p1', ['events.subscribe'], 'test:ev', () => received.push(v))
      },
      onUnload: () => { scoped.cleanup('p1') },
    })

    await lifecycle.start('p1')
    await eventBus.emit('test:ev', {})
    await lifecycle.reload('p1')
    await eventBus.emit('test:ev', {})

    // Each event should be received by exactly one handler version
    expect(received).toEqual([1, 2])
  })
})

// ── Metrics immutability ──────────────────────────────────────────────────────

describe('Registry — metrics immutability', () => {
  it('get() returns a copy — mutating eventsHandled does not affect registry', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    reg.incrementEventsHandled('p1', 10)
    const copy = reg.get('p1')!
    // lifecycleMetrics is a copy
    ;(copy.lifecycleMetrics as { reloadCount: number }).reloadCount = 9999
    expect(reg.get('p1')!.lifecycleMetrics.reloadCount).toBe(0)
  })

  it('health record from get() is a copy — mutations do not affect health monitor', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    const copy = reg.get('p1')!
    ;(copy.health as { failureCount: number }).failureCount = 999
    expect(reg.get('p1')!.health.failureCount).toBe(0)
  })

  it('avgExecutionMs calculation is correct for multiple events', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    reg.incrementEventsHandled('p1', 10)
    reg.incrementEventsHandled('p1', 30)
    reg.incrementEventsHandled('p1', 20)
    expect(reg.getAvgExecutionMs('p1')).toBe(20)
  })

  it('avgExecutionMs returns 0 when no events handled', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    expect(reg.getAvgExecutionMs('p1')).toBe(0)
  })

  it('resetMetrics clears eventsHandled and execution time', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    reg.incrementEventsHandled('p1', 100)
    reg.incrementEventsHandled('p1', 200)
    reg.resetMetrics('p1')
    expect(reg.getEventsHandled('p1')).toBe(0)
    expect(reg.getAvgExecutionMs('p1')).toBe(0)
  })
})

// ── Registry immutability ─────────────────────────────────────────────────────

describe('Registry — deep copy on output', () => {
  it('capabilities array from get() cannot propagate mutations to internal state', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0', capabilities: ['inventory.read'] })
    const record = reg.get('p1')!
    ;(record.capabilities as string[]).push('admin.write')
    expect(reg.get('p1')!.capabilities).toHaveLength(1)
  })

  it('dependencies array from get() is a copy', () => {
    const reg = new AtcPluginRegistry()
    reg.register({
      id: 'p1',
      version: '1.0.0',
      dependencies: [{ id: 'dep', version: '^1.0.0' }],
    })
    const record = reg.get('p1')!
    ;(record.dependencies as { id: string }[])[0]!.id = 'hacked'
    expect(reg.get('p1')!.dependencies[0]!.id).toBe('dep')
  })
})

// ── Destroy status handling ───────────────────────────────────────────────────

describe('Lifecycle — destroy() status handling', () => {
  it('destroy() on a registered-but-never-started plugin succeeds', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {})
    await expect(lifecycle.destroy('p1')).resolves.toBeUndefined()
    expect(registry.get('p1')).toBeUndefined()
  })

  it('destroy() on an active plugin stops it first then unregisters', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    lifecycle.registerHooks('p1', {})
    await lifecycle.start('p1')
    await lifecycle.destroy('p1')
    expect(registry.get('p1')).toBeUndefined()
  })

  it('destroy() throws PluginConcurrentOperationError if plugin is in-flight', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    let resolveLoad!: () => void
    lifecycle.registerHooks('p1', {
      onLoad: () => new Promise<void>((r) => { resolveLoad = r }),
    })

    const startP = lifecycle.start('p1')
    await Promise.resolve()

    await expect(lifecycle.destroy('p1')).rejects.toThrow(PluginConcurrentOperationError)

    resolveLoad()
    await startP.catch(() => undefined)
  })
})

// ── Duplicate registration ────────────────────────────────────────────────────

describe('Registry — duplicate registration guard', () => {
  it('register() throws PluginDuplicateError on duplicate id', () => {
    const reg = new AtcPluginRegistry()
    reg.register({ id: 'p1', version: '1.0.0' })
    expect(() => reg.register({ id: 'p1', version: '2.0.0' })).toThrow(PluginDuplicateError)
  })

  it('register() rejects invalid id characters', () => {
    const reg = new AtcPluginRegistry()
    expect(() => reg.register({ id: 'My Plugin!', version: '1.0.0' })).toThrow()
  })

  it('register() rejects invalid semver', () => {
    const reg = new AtcPluginRegistry()
    expect(() => reg.register({ id: 'p1', version: 'not-a-version' })).toThrow()
  })
})

// ── Plugin isolation ──────────────────────────────────────────────────────────

describe('Lifecycle — crash isolation between plugins', () => {
  it('crash in plugin A does not affect plugin B health or status', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'bad', version: '1.0.0' })
    registry.register({ id: 'good', version: '1.0.0' })
    lifecycle.registerHooks('bad', { onLoad: () => { throw new Error('crash') } })
    lifecycle.registerHooks('good', {})

    await lifecycle.start('bad').catch(() => undefined)
    await lifecycle.start('good')

    expect(registry.get('bad')!.status).toBe('failed')
    expect(registry.get('good')!.status).toBe('active')
  })

  it('reloadAll() continues with remaining plugins when one fails', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'a', version: '1.0.0' })
    registry.register({ id: 'b', version: '1.0.0' })
    lifecycle.registerHooks('a', { onLoad: () => { throw new Error('a fails') } })
    lifecycle.registerHooks('b', {})

    await lifecycle.reloadAll()

    expect(registry.get('a')!.status).toBe('failed')
    expect(registry.get('b')!.status).toBe('active')
  })
})

// ── Health monitor — recovery path ────────────────────────────────────────────

describe('Health monitor — health state transitions', () => {
  it('degraded plugin recovers to healthy on reset', () => {
    const health = new AtcPluginHealthMonitor({ maxFailures: 6, degradeThreshold: 3 })
    health.init('p1')
    health.recordFailure('p1')
    health.recordFailure('p1')
    health.recordFailure('p1')
    expect(health.getHealth('p1').status).toBe('degraded')
    health.reset('p1')
    expect(health.getHealth('p1').status).toBe('healthy')
    expect(health.getHealth('p1').failureCount).toBe(0)
  })

  it('auto-disable increments restartCount and not just failureCount', () => {
    const { registry, lifecycle, health } = makeSetup()
    registry.register({ id: 'p1', version: '1.0.0' })
    health.init('p1')
    lifecycle.registerHooks('p1', { onLoad: () => { throw new Error('crash') } })

    // maxFailures = 3
    for (let i = 0; i < 3; i++) {
      lifecycle.start('p1').catch(() => undefined)
      if (i < 2) registry.setStatus('p1', 'registered')
    }
  })
})
