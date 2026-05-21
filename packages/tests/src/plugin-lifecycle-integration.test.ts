import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AtcPluginRegistry,
  AtcPluginLifecycleManager,
  AtcPluginHealthMonitor,
  AtcPluginScopedEventBus,
} from '@atc/plugin-registry'
import { AtcEventBus } from '@atc/events'
import { createPluginServiceContainer } from '@atc/plugin-runtime-api'
import type { AtcPluginServiceContainer, AtcPluginHooks, AtcPluginLogger } from '@atc/shared-types'
import { AtcTelemetryService } from '@atc/telemetry'

function makeSilentLogger(): AtcPluginLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

function makeLifecycle(opts: {
  pluginState?: Parameters<typeof AtcPluginLifecycleManager>[3] extends { pluginState?: infer T } ? T : never
} = {}) {
  const registry = new AtcPluginRegistry()
  const health = new AtcPluginHealthMonitor()
  const bus = new AtcEventBus()
  const scoped = new AtcPluginScopedEventBus(bus)
  const telemetry = new AtcTelemetryService()

  const lifecycle = new AtcPluginLifecycleManager(registry, health, bus, {
    timeoutMs: 2000,
    scopedEventBus: scoped,
    pluginState: opts.pluginState,
    containerFactory: (pluginId, capabilities) =>
      createPluginServiceContainer({
        pluginId,
        capabilities,
        logger: makeSilentLogger(),
        registry,
        scopedEventBus: scoped,
        telemetry,
      }),
  })

  return { registry, health, bus, scoped, lifecycle, telemetry }
}

describe('Lifecycle — onSetup hook', () => {
  it('calls onSetup with a service container before onLoad', async () => {
    const { registry, lifecycle } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0', capabilities: ['telemetry.write'] })

    const callOrder: string[] = []
    let receivedContainer: AtcPluginServiceContainer | undefined

    const hooks: AtcPluginHooks = {
      onSetup: (container) => { callOrder.push('setup'); receivedContainer = container },
      onLoad: () => { callOrder.push('load') },
      onEnable: () => { callOrder.push('enable') },
    }
    lifecycle.registerHooks('test-plugin', hooks)
    await lifecycle.start('test-plugin')

    expect(callOrder).toEqual(['setup', 'load', 'enable'])
    expect(receivedContainer).toBeDefined()
    expect(receivedContainer!.pluginId).toBe('test-plugin')
    expect(registry.get('test-plugin')?.status).toBe('active')
  })

  it('container is accessible via getContainer while plugin is active', async () => {
    const { registry, lifecycle } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')

    const container = lifecycle.getContainer('test-plugin')
    expect(container).toBeDefined()
    expect(container!.pluginId).toBe('test-plugin')
  })

  it('disposes container cleanup on stop', async () => {
    const { registry, lifecycle } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0' })

    const cleanupFn = vi.fn()
    lifecycle.registerHooks('test-plugin', {
      onSetup: (container) => {
        container.cleanup.onCleanup(cleanupFn)
      },
    })

    await lifecycle.start('test-plugin')
    await lifecycle.stop('test-plugin')

    expect(cleanupFn).toHaveBeenCalledOnce()
    expect(lifecycle.getContainer('test-plugin')).toBeUndefined()
  })

  it('cleans up scoped event bus subscriptions on stop', async () => {
    const { registry, lifecycle, scoped } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0', capabilities: ['events.subscribe'] })

    lifecycle.registerHooks('test-plugin', {
      onEnable: () => {
        // Will be cleaned up — getContainer returns the live container
      },
    })

    await lifecycle.start('test-plugin')
    const container = lifecycle.getContainer('test-plugin')!
    container.eventsApi.on('some:event', vi.fn())
    expect(scoped.getSubscriptionCount('test-plugin')).toBe(1)

    await lifecycle.stop('test-plugin')
    expect(scoped.getSubscriptionCount('test-plugin')).toBe(0)
  })
})

describe('Lifecycle — health.resetFailures on success', () => {
  it('resets failure count after successful start', async () => {
    const { registry, health, lifecycle } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0' })

    // Manually record failures until degraded threshold (ceil(5/2) = 3 failures)
    health.recordFailure('test-plugin', 'prev error')
    health.recordFailure('test-plugin', 'prev error')
    health.recordFailure('test-plugin', 'prev error')
    expect(health.getHealth('test-plugin').failureCount).toBe(3)
    expect(health.getHealth('test-plugin').status).toBe('degraded')

    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')

    const healthRecord = health.getHealth('test-plugin')
    expect(healthRecord.failureCount).toBe(0)
    expect(healthRecord.status).toBe('healthy')
  })
})

describe('Lifecycle — pluginState integration', () => {
  it('skips start when persisted state says enabled=false', async () => {
    const pluginState = {
      load: vi.fn().mockResolvedValue({ enabled: false, crashCount: 0 }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      incrementCrashCount: vi.fn().mockResolvedValue(1),
    }

    const { registry, lifecycle } = makeLifecycle({ pluginState })
    registry.register({ id: 'test-plugin', version: '1.0.0' })

    const onLoad = vi.fn()
    lifecycle.registerHooks('test-plugin', { onLoad })

    await lifecycle.start('test-plugin')

    expect(onLoad).not.toHaveBeenCalled()
    expect(registry.get('test-plugin')?.status).toBe('disabled')
  })

  it('persists success via setEnabled on successful start', async () => {
    const pluginState = {
      load: vi.fn().mockResolvedValue({ enabled: true, crashCount: 0 }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      incrementCrashCount: vi.fn().mockResolvedValue(1),
    }

    const { registry, lifecycle } = makeLifecycle({ pluginState })
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {})
    await lifecycle.start('test-plugin')

    expect(pluginState.setEnabled).toHaveBeenCalledWith('test-plugin', true)
  })

  it('increments crash count on lifecycle failure', async () => {
    const pluginState = {
      load: vi.fn().mockResolvedValue({ enabled: true, crashCount: 0 }),
      setEnabled: vi.fn().mockResolvedValue(undefined),
      incrementCrashCount: vi.fn().mockResolvedValue(1),
    }

    const { registry, lifecycle } = makeLifecycle({ pluginState })
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    lifecycle.registerHooks('test-plugin', {
      onLoad: () => { throw new Error('load failed') },
    })

    await expect(lifecycle.start('test-plugin')).rejects.toThrow('load failed')
    expect(pluginState.incrementCrashCount).toHaveBeenCalledWith('test-plugin')
  })
})

describe('Lifecycle — registry apiCalls/deniedCalls', () => {
  it('tracks api calls made by plugin during its active lifecycle', async () => {
    const { registry, lifecycle } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0', capabilities: ['telemetry.write'] })

    lifecycle.registerHooks('test-plugin', {
      onEnable: () => {
        // Access container after lifecycle sets it up
      },
    })

    await lifecycle.start('test-plugin')
    const container = lifecycle.getContainer('test-plugin')!
    container.telemetryApi.record('test', 1)
    container.telemetryApi.record('test2', 2)

    expect(registry.getApiCalls('test-plugin')).toBe(2)
  })

  it('registry reports uptime since registration', () => {
    const { registry } = makeLifecycle()
    registry.register({ id: 'test-plugin', version: '1.0.0' })

    const uptimeMs = registry.getUptimeMs('test-plugin')
    expect(uptimeMs).toBeGreaterThanOrEqual(0)
    expect(uptimeMs).toBeLessThan(1000)
  })
})
