import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPluginServiceContainer } from '@atc/plugin-runtime-api'
import { AtcPluginRegistry, AtcPluginScopedEventBus } from '@atc/plugin-registry'
import { AtcTelemetryService } from '@atc/telemetry'
import { AtcEventBus } from '@atc/events'
import {
  AtcTaskRuntime,
  InMemoryTaskQueueStorage,
} from '@atc/task-runtime'
import type { AtcPluginLogger } from '@atc/shared-types'

function makeSilentLogger(): AtcPluginLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}

function makeSetup() {
  const registry = new AtcPluginRegistry()
  const eventBus = new AtcEventBus()
  const scopedEventBus = new AtcPluginScopedEventBus(eventBus)
  const telemetry = new AtcTelemetryService()
  const storage = new InMemoryTaskQueueStorage()
  const taskRuntime = new AtcTaskRuntime({ storage, telemetry, eventBus })
  return { registry, eventBus, scopedEventBus, telemetry, taskRuntime, storage }
}

describe('Plugin tasksApi — capability enforcement', () => {
  it('tasksApi is undefined when plugin lacks tasks.* capabilities', () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['telemetry.write'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['telemetry.write'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    expect(container.tasksApi).toBeUndefined()
  })

  it('tasksApi is defined when plugin has tasks.enqueue', () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    expect(container.tasksApi).toBeDefined()
  })

  it('tasksApi is undefined when taskRuntime is not provided', () => {
    const { registry, scopedEventBus, telemetry } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      // taskRuntime not provided
    })

    expect(container.tasksApi).toBeUndefined()
  })
})

describe('Plugin tasksApi — enqueue', () => {
  it('enqueue returns ok:true with task ID when permitted', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    const result = await container.tasksApi!.enqueue('my.task', { data: 'hello' })
    expect(result.ok).toBe(true)
    expect(typeof result.data).toBe('string')
  })

  it('enqueue uses plugin-scoped queue name', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime, storage } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    await container.tasksApi!.enqueue('my.task', null)
    const depth = await storage.len('atc:tasks:plugin:plugin-a')
    expect(depth).toBe(1)
  })

  it('enqueue returns ok:false when lacking tasks.enqueue capability', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.schedule'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.schedule'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    // tasksApi present because tasks.schedule is declared
    const result = await container.tasksApi!.enqueue('my.task', null)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('tasks.enqueue required')
  })

  it('denied enqueue increments deniedCalls in registry', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.schedule'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.schedule'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    await container.tasksApi!.enqueue('my.task', null)
    expect(registry.getDeniedCalls('plugin-a')).toBe(1)
  })

  it('successful enqueue increments apiCalls in registry', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    await container.tasksApi!.enqueue('my.task', null)
    expect(registry.getApiCalls('plugin-a')).toBe(1)
  })

  it('enqueue returns ok:false for invalid task type', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    const result = await container.tasksApi!.enqueue('INVALID TYPE!', null)
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })
})

describe('Plugin tasksApi — schedule', () => {
  it('schedule returns ok:true when permitted', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.schedule'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.schedule'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    const result = await container.tasksApi!.schedule('my.task', null, 5000)
    expect(result.ok).toBe(true)
    expect(typeof result.data).toBe('string')
  })

  it('schedule returns ok:false when lacking tasks.schedule capability', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    const result = await container.tasksApi!.schedule('my.task', null, 5000)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('tasks.schedule required')
  })

  it('schedule clamps delayMs to max 24 hours', async () => {
    const { registry, scopedEventBus, telemetry, taskRuntime, storage } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.schedule'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.schedule'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    const result = await container.tasksApi!.schedule('my.task', null, 999_999_999)
    expect(result.ok).toBe(true)
    // Should be in delayed queue (clamped to 86_400_000ms = 24h)
    const delayed = await storage.lenDelayed()
    expect(delayed).toBe(1)
  })

  it('container is frozen (tasksApi is present but container is immutable)', () => {
    const { registry, scopedEventBus, telemetry, taskRuntime } = makeSetup()
    registry.register({ id: 'plugin-a', version: '1.0.0', capabilities: ['tasks.enqueue'] })

    const container = createPluginServiceContainer({
      pluginId: 'plugin-a',
      capabilities: ['tasks.enqueue'],
      logger: makeSilentLogger(),
      registry,
      scopedEventBus,
      telemetry,
      taskRuntime,
    })

    expect(Object.isFrozen(container)).toBe(true)
    expect(container.tasksApi).toBeDefined()
  })
})
