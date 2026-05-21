import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPluginServiceContainer, PluginCleanupManager } from '@atc/plugin-runtime-api'
import type { AtcPluginLogger, AtcPluginCapability } from '@atc/shared-types'
import { AtcPluginRegistry, AtcPluginScopedEventBus } from '@atc/plugin-registry'
import { AtcTelemetryService } from '@atc/telemetry'
import { AtcEventBus } from '@atc/events'

function makeMockLogger(): AtcPluginLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}

describe('createPluginServiceContainer', () => {
  let registry: AtcPluginRegistry
  let scopedEventBus: AtcPluginScopedEventBus
  let telemetry: AtcTelemetryService

  beforeEach(() => {
    registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0', capabilities: ['vitals.read', 'vitals.write', 'events.subscribe', 'events.publish', 'telemetry.write'] })
    scopedEventBus = new AtcPluginScopedEventBus(new AtcEventBus())
    telemetry = new AtcTelemetryService()
  })

  it('returns a frozen container with all fields', () => {
    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['telemetry.write'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
    })

    expect(Object.isFrozen(container)).toBe(true)
    expect(container.pluginId).toBe('test-plugin')
    expect(container.cleanup).toBeInstanceOf(PluginCleanupManager)
    expect(container.eventsApi).toBeDefined()
    expect(container.telemetryApi).toBeDefined()
  })

  it('provides vitalsApi when plugin has vitals.read capability and service is provided', () => {
    const vitalsService = {
      get: vi.fn().mockResolvedValue(undefined),
      mutate: vi.fn(),
    }

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['vitals.read'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
      vitalsService,
    })

    expect(container.vitalsApi).toBeDefined()
  })

  it('vitalsApi is undefined when no vitals capability declared', () => {
    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['telemetry.write'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
    })

    expect(container.vitalsApi).toBeUndefined()
  })

  it('provides inventoryApi only when capability and service provided', () => {
    const inventoryService = {
      getSlots: vi.fn().mockResolvedValue([]),
      addItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    }

    const withCap = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['inventory.read'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
      inventoryService,
    })
    expect(withCap.inventoryApi).toBeDefined()

    const withoutCap = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['telemetry.write'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
      inventoryService,
    })
    expect(withoutCap.inventoryApi).toBeUndefined()
  })

  it('provides walletApi only when capability and service provided', () => {
    const walletService = {
      getWallet: vi.fn().mockResolvedValue(undefined),
      credit: vi.fn(),
      debit: vi.fn(),
    }

    const withCap = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['wallet.read'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
      walletService,
    })
    expect(withCap.walletApi).toBeDefined()

    const noCap = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: [],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry,
      walletService,
    })
    expect(noCap.walletApi).toBeUndefined()
  })
})

describe('PluginVitalsApi via container', () => {
  let registry: AtcPluginRegistry
  let scopedEventBus: AtcPluginScopedEventBus

  beforeEach(() => {
    registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    scopedEventBus = new AtcPluginScopedEventBus(new AtcEventBus())
  })

  it('read returns ok when service resolves', async () => {
    const mockVitals = { characterId: 'char-1', health: 100, hunger: 80, thirst: 90, stamina: 70, stress: 10, armor: 0, createdAt: new Date(), updatedAt: new Date() }
    const vitalsService = { get: vi.fn().mockResolvedValue(mockVitals), mutate: vi.fn() }

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['vitals.read'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry: new AtcTelemetryService(),
      vitalsService,
    })

    const result = await container.vitalsApi!.read('char-1')
    expect(result.ok).toBe(true)
    expect(result.data).toEqual(mockVitals)
    expect(registry.getApiCalls('test-plugin')).toBe(1)
  })

  it('read returns denied when missing vitals.read capability', async () => {
    const vitalsService = { get: vi.fn(), mutate: vi.fn() }

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['vitals.write'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry: new AtcTelemetryService(),
      vitalsService,
    })

    const result = await container.vitalsApi!.read('char-1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('vitals.read')
    expect(registry.getDeniedCalls('test-plugin')).toBe(1)
  })

  it('read returns error when service throws', async () => {
    const vitalsService = { get: vi.fn().mockRejectedValue(new Error('DB error')), mutate: vi.fn() }

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['vitals.read'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry: new AtcTelemetryService(),
      vitalsService,
    })

    const result = await container.vitalsApi!.read('char-1')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('DB error')
  })

  it('mutate denied without vitals.write', async () => {
    const vitalsService = { get: vi.fn(), mutate: vi.fn() }

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['vitals.read'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus,
      telemetry: new AtcTelemetryService(),
      vitalsService,
    })

    const result = await container.vitalsApi!.mutate('char-1', { health: 50 })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('vitals.write')
    expect(registry.getDeniedCalls('test-plugin')).toBe(1)
  })
})

describe('PluginTelemetryApi via container', () => {
  it('records metrics when telemetry.write capability present', () => {
    const registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const telemetry = new AtcTelemetryService()

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['telemetry.write'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus: new AtcPluginScopedEventBus(new AtcEventBus()),
      telemetry,
    })

    container.telemetryApi.record('my_metric', 42, 'gauge')

    const metric = telemetry.get('plugin.test-plugin.my_metric')
    expect(metric).toBeDefined()
    expect(metric!.value).toBe(42)
    expect(metric!.kind).toBe('gauge')
    expect(registry.getApiCalls('test-plugin')).toBe(1)
  })

  it('silently ignores record when telemetry.write not declared', () => {
    const registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const telemetry = new AtcTelemetryService()

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: [],
      logger: makeMockLogger(),
      registry,
      scopedEventBus: new AtcPluginScopedEventBus(new AtcEventBus()),
      telemetry,
    })

    container.telemetryApi.record('my_metric', 1)
    expect(telemetry.get('plugin.test-plugin.my_metric')).toBeUndefined()
    expect(registry.getDeniedCalls('test-plugin')).toBe(1)
  })

  it('time() resolves and records duration', async () => {
    const registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const telemetry = new AtcTelemetryService()

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['telemetry.write'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus: new AtcPluginScopedEventBus(new AtcEventBus()),
      telemetry,
    })

    const result = await container.telemetryApi.time('op', async () => 'done')
    expect(result).toBe('done')
    expect(telemetry.get('plugin.test-plugin.op.duration_ms')).toBeDefined()
  })
})

describe('PluginEventsApi via container', () => {
  it('on() subscribes and handler receives events', async () => {
    const registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const bus = new AtcEventBus()
    const scoped = new AtcPluginScopedEventBus(bus)

    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['events.subscribe', 'events.publish'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus: scoped,
      telemetry: new AtcTelemetryService(),
    })

    const handler = vi.fn()
    container.eventsApi.on('test:event', handler)
    await bus.emit('test:event', { foo: 'bar' })
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('emit() returns ok when events.publish declared', async () => {
    const registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['events.subscribe', 'events.publish'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus: new AtcPluginScopedEventBus(new AtcEventBus()),
      telemetry: new AtcTelemetryService(),
    })

    const result = await container.eventsApi.emit('test:event', { x: 1 })
    expect(result.ok).toBe(true)
  })

  it('emit() returns denied when events.publish not declared', async () => {
    const registry = new AtcPluginRegistry()
    registry.register({ id: 'test-plugin', version: '1.0.0' })
    const container = createPluginServiceContainer({
      pluginId: 'test-plugin',
      capabilities: ['events.subscribe'],
      logger: makeMockLogger(),
      registry,
      scopedEventBus: new AtcPluginScopedEventBus(new AtcEventBus()),
      telemetry: new AtcTelemetryService(),
    })

    const result = await container.eventsApi.emit('test:event')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('events.publish')
    expect(registry.getDeniedCalls('test-plugin')).toBe(1)
  })
})
