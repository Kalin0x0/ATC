import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AtcPluginRegistry,
  AtcPluginLifecycleManager,
  AtcPluginHealthMonitor,
  PluginNotFoundError,
  PluginLifecycleTimeoutError,
} from '@atc/plugin-registry'
import { AtcEventBus } from '@atc/events'

function makeSetup(timeoutMs = 500) {
  const registry = new AtcPluginRegistry()
  const health = new AtcPluginHealthMonitor({ maxFailures: 3 })
  const eventBus = new AtcEventBus({ metricsEnabled: false })
  const lifecycle = new AtcPluginLifecycleManager(registry, health, eventBus, { timeoutMs })
  return { registry, health, eventBus, lifecycle }
}

// ── start ─────────────────────────────────────────────────────────────────────

describe('AtcPluginLifecycleManager — start', () => {
  it('runs onLoad → onEnable and sets status to active', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const order: string[] = []
    lifecycle.registerHooks('test-plugin', {
      onLoad: () => { order.push('load') },
      onEnable: () => { order.push('enable') },
    })
    await lifecycle.start('test-plugin')
    expect(order).toEqual(['load', 'enable'])
    expect(registry.get('test-plugin')!.status).toBe('active')
  })

  it('sets loadedAt on start', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    expect(registry.get('test-plugin')!.loadedAt).not.toBeNull()
  })

  it('sets status to failed when onLoad throws', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {
      onLoad: () => { throw new Error('load failed') },
    })
    await expect(lifecycle.start('test-plugin')).rejects.toThrow('load failed')
    expect(registry.get('test-plugin')!.status).toBe('failed')
  })

  it('works with no hooks registered', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    await expect(lifecycle.start('test-plugin')).resolves.toBeUndefined()
    expect(registry.get('test-plugin')!.status).toBe('active')
  })

  it('throws PluginNotFoundError for unknown id', async () => {
    const { lifecycle } = makeSetup()
    await expect(lifecycle.start('ghost')).rejects.toThrow(PluginNotFoundError)
  })

  it('emits atc:plugin:failed on hook error', async () => {
    const { registry, eventBus, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', { onLoad: () => { throw new Error('boom') } })
    const failedEvents: unknown[] = []
    eventBus.on('atc:plugin:failed', (p) => failedEvents.push(p))
    await lifecycle.start('test-plugin').catch(() => undefined)
    await new Promise((r) => setTimeout(r, 0))
    expect(failedEvents).toHaveLength(1)
  })

  it('auto-disables plugin after exceeding maxFailures', async () => {
    const { registry, lifecycle, health } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', { onLoad: () => { throw new Error('fail') } })
    // maxFailures = 3
    for (let i = 0; i < 3; i++) {
      await lifecycle.start('test-plugin').catch(() => undefined)
      // reset status so we can try again
      if (i < 2) registry.setStatus('test-plugin', 'registered')
    }
    expect(registry.get('test-plugin')!.status).toBe('disabled')
  })
})

// ── stop ──────────────────────────────────────────────────────────────────────

describe('AtcPluginLifecycleManager — stop', () => {
  it('runs onDisable → onUnload and sets status to disabled', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    const order: string[] = []
    lifecycle.registerHooks('test-plugin', {
      onDisable: () => { order.push('disable') },
      onUnload: () => { order.push('unload') },
    })
    await lifecycle.stop('test-plugin')
    expect(order).toEqual(['disable', 'unload'])
    expect(registry.get('test-plugin')!.status).toBe('disabled')
  })

  it('still reaches disabled status even if onDisable throws', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    await lifecycle.start('test-plugin')
    lifecycle.registerHooks('test-plugin', {
      onDisable: () => { throw new Error('disable error') },
    })
    await lifecycle.stop('test-plugin')
    expect(registry.get('test-plugin')!.status).toBe('disabled')
  })
})

// ── reload ────────────────────────────────────────────────────────────────────

describe('AtcPluginLifecycleManager — reload', () => {
  it('increments reloadCount', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    await lifecycle.reload('test-plugin')
    expect(registry.get('test-plugin')!.lifecycleMetrics.reloadCount).toBeGreaterThanOrEqual(1)
  })

  it('plugin is active after successful reload', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    await lifecycle.reload('test-plugin')
    expect(registry.get('test-plugin')!.status).toBe('active')
  })

  it('emits atc:plugin:reloaded on success', async () => {
    const { registry, eventBus, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    const reloaded: unknown[] = []
    eventBus.on('atc:plugin:reloaded', (p) => reloaded.push(p))
    await lifecycle.reload('test-plugin')
    await new Promise((r) => setTimeout(r, 0))
    expect(reloaded).toHaveLength(1)
  })
})

// ── timeout ───────────────────────────────────────────────────────────────────

describe('AtcPluginLifecycleManager — timeout', () => {
  it('throws PluginLifecycleTimeoutError when hook exceeds timeout', async () => {
    const { registry, lifecycle } = makeSetup(50)
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {
      onLoad: () => new Promise((r) => setTimeout(r, 200)),
    })
    await expect(lifecycle.start('test-plugin')).rejects.toThrow(PluginLifecycleTimeoutError)
  })
})

// ── cleanup ───────────────────────────────────────────────────────────────────

describe('AtcPluginLifecycleManager — cleanup on stop', () => {
  it('runs registered cleanup functions on stop', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    const cleaned = vi.fn()
    lifecycle.addCleanup('test-plugin', cleaned)
    await lifecycle.stop('test-plugin')
    expect(cleaned).toHaveBeenCalledOnce()
  })

  it('cleanup fns are removed after stop (idempotent)', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')
    const cleaned = vi.fn()
    lifecycle.addCleanup('test-plugin', cleaned)
    await lifecycle.stop('test-plugin')
    // Restart and stop again without re-registering cleanup
    await lifecycle.start('test-plugin')
    await lifecycle.stop('test-plugin')
    expect(cleaned).toHaveBeenCalledTimes(1)
  })
})

// ── isolation ─────────────────────────────────────────────────────────────────

describe('AtcPluginLifecycleManager — isolation', () => {
  it('one plugin failing does not prevent another from starting', async () => {
    const { registry, lifecycle } = makeSetup()
    registry.register({ id: 'bad', version: '1.0.0' })
    registry.register({ id: 'good', version: '1.0.0' })
    lifecycle.registerHooks('bad', { onLoad: () => { throw new Error('bad') } })
    lifecycle.registerHooks('good', {})
    await lifecycle.start('bad').catch(() => undefined)
    await expect(lifecycle.start('good')).resolves.toBeUndefined()
    expect(registry.get('good')!.status).toBe('active')
  })
})
