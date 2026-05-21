import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AtcPluginContainer } from '@atc/plugin-runtime'

function makeLifecycle() {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    isInflight: vi.fn().mockReturnValue(false),
  }
}

function makeRegistry(overrides: Partial<{
  status: string; lastError: string | null; health: { status: string; restartCount: number }
}> = {}) {
  const record = {
    status: overrides.status ?? 'active',
    lastError: overrides.lastError ?? null,
    health: overrides.health ?? { status: 'healthy', restartCount: 0 },
  }
  return {
    get: vi.fn().mockReturnValue(record),
    setStatus: vi.fn(),
  }
}

function makeTelemetry() {
  return { increment: vi.fn() }
}

describe('AtcPluginContainer', () => {
  describe('start()', () => {
    it('calls lifecycle.start and marks tracker started', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin')
      await container.start()
      expect(lifecycle.start).toHaveBeenCalledWith('my-plugin')
    })

    it('increments plugins.active_total telemetry', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const telemetry = makeTelemetry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', { telemetry: telemetry as never })
      await container.start()
      expect(telemetry.increment).toHaveBeenCalledWith('plugins.active_total')
    })

    it('exposes pluginId', () => {
      const container = new AtcPluginContainer(makeLifecycle(), makeRegistry(), 'test-plugin')
      expect(container.pluginId).toBe('test-plugin')
    })
  })

  describe('stop()', () => {
    it('calls lifecycle.stop', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin')
      await container.start()
      await container.stop()
      expect(lifecycle.stop).toHaveBeenCalledWith('my-plugin')
    })

    it('sets status to stopped in registry', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin')
      await container.stop()
      expect(registry.setStatus).toHaveBeenCalledWith('my-plugin', 'stopped')
    })

    it('increments plugins.failed_total telemetry', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const telemetry = makeTelemetry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', { telemetry: telemetry as never })
      await container.stop()
      expect(telemetry.increment).toHaveBeenCalledWith('plugins.failed_total')
    })
  })

  describe('reload()', () => {
    it('calls lifecycle.reload', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin')
      await container.reload()
      expect(lifecycle.reload).toHaveBeenCalledWith('my-plugin')
    })

    it('increments plugins.reload_total telemetry', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const telemetry = makeTelemetry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', { telemetry: telemetry as never })
      await container.reload()
      expect(telemetry.increment).toHaveBeenCalledWith('plugins.reload_total')
    })

    it('increments restartCount on tracker', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin')
      await container.reload()
      expect(container.resourceTracker.getRestartCount()).toBe(1)
    })
  })

  describe('handleCrash()', () => {
    it('increments crash count', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 5,
        initialBackoffMs: 100_000, // very long — won't fire in test
      })
      await container.handleCrash(new Error('boom'))
      expect(container.resourceTracker.getCrashCount()).toBe(1)
    })

    it('sets status to restarting while below maxRestarts', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 5,
        initialBackoffMs: 100_000,
      })
      await container.handleCrash(new Error('first'))
      expect(registry.setStatus).toHaveBeenCalledWith('my-plugin', 'restarting', 'first')
    })

    it('auto-disables after maxRestarts exceeded', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const telemetry = makeTelemetry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 2,
        initialBackoffMs: 100_000,
        telemetry: telemetry as never,
      })
      await container.handleCrash(new Error('crash1'))
      await container.handleCrash(new Error('crash2'))
      // Third crash exceeds maxRestarts=2
      await container.handleCrash(new Error('crash3'))
      expect(registry.setStatus).toHaveBeenCalledWith('my-plugin', 'disabled', 'crash3')
      expect(telemetry.increment).toHaveBeenCalledWith('plugins.auto_disabled_total')
    })

    it('increments plugins.crash_total on each crash', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const telemetry = makeTelemetry()
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 5,
        initialBackoffMs: 100_000,
        telemetry: telemetry as never,
      })
      await container.handleCrash(new Error('boom'))
      expect(telemetry.increment).toHaveBeenCalledWith('plugins.crash_total')
    })

    it('stop() cancels pending restart timer', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 5,
        initialBackoffMs: 50,
      })
      await container.handleCrash(new Error('boom'))
      await container.stop() // cancels timer before it fires
      await new Promise((r) => setTimeout(r, 100))
      // lifecycle.start should NOT be called again after stop
      expect(lifecycle.start).not.toHaveBeenCalled()
    })

    it('triggers restart via lifecycle.start after backoff when below limit', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'active' })
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 5,
        initialBackoffMs: 20,
      })
      await container.handleCrash(new Error('boom'))
      await new Promise((r) => setTimeout(r, 60))
      expect(lifecycle.start).toHaveBeenCalledWith('my-plugin')
    })
  })

  describe('getHealthSnapshot()', () => {
    it('returns healthy=true when registry health is healthy', () => {
      const registry = makeRegistry({ status: 'active', health: { status: 'healthy', restartCount: 0 } })
      const container = new AtcPluginContainer(makeLifecycle(), registry, 'my-plugin')
      const snap = container.getHealthSnapshot()
      expect(snap.healthy).toBe(true)
      expect(snap.pluginId).toBe('my-plugin')
      expect(snap.state).toBe('active')
    })

    it('returns healthy=false when registry health is degraded or failed', () => {
      const registry = makeRegistry({ status: 'failed', health: { status: 'failed', restartCount: 0 } })
      const container = new AtcPluginContainer(makeLifecycle(), registry, 'my-plugin')
      const snap = container.getHealthSnapshot()
      expect(snap.healthy).toBe(false)
    })

    it('includes resource usage fields', async () => {
      const registry = makeRegistry()
      const container = new AtcPluginContainer(makeLifecycle(), registry, 'my-plugin')
      container.resourceTracker.trackTimer()
      container.resourceTracker.trackSubscription()
      const snap = container.getHealthSnapshot()
      expect(snap.resourceUsage.activeTimers).toBe(1)
      expect(snap.resourceUsage.activeSubscriptions).toBe(1)
    })

    it('includes capturedAt timestamp', () => {
      const registry = makeRegistry()
      const container = new AtcPluginContainer(makeLifecycle(), registry, 'my-plugin')
      const snap = container.getHealthSnapshot()
      expect(snap.capturedAt).toBeTruthy()
      expect(new Date(snap.capturedAt).getTime()).toBeGreaterThan(0)
    })

    it('returns failed state when registry has no record', () => {
      const registry = {
        get: vi.fn().mockReturnValue(undefined),
        setStatus: vi.fn(),
      }
      const container = new AtcPluginContainer(makeLifecycle(), registry, 'missing-plugin')
      const snap = container.getHealthSnapshot()
      expect(snap.state).toBe('failed')
      expect(snap.healthy).toBe(false)
    })
  })

  describe('backoff progression', () => {
    it('doubles backoff on each successive crash', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 10,
        initialBackoffMs: 10,
        maxBackoffMs: 1_000,
        backoffMultiplier: 2,
      })

      // First crash — backoff 10ms
      await container.handleCrash(new Error('c1'))
      await new Promise((r) => setTimeout(r, 30))
      expect(lifecycle.start).toHaveBeenCalledTimes(1)

      // Second crash — backoff 20ms
      await container.handleCrash(new Error('c2'))
      await new Promise((r) => setTimeout(r, 50))
      expect(lifecycle.start).toHaveBeenCalledTimes(2)
    })

    it('caps backoff at maxBackoffMs', async () => {
      const lifecycle = makeLifecycle()
      const registry = makeRegistry({ status: 'failed' })
      const container = new AtcPluginContainer(lifecycle, registry, 'my-plugin', {
        maxRestarts: 10,
        initialBackoffMs: 10,
        maxBackoffMs: 10,
        backoffMultiplier: 100,
      })
      // Even with high multiplier, should stay at cap
      await container.handleCrash(new Error('c1'))
      await new Promise((r) => setTimeout(r, 30))
      expect(lifecycle.start).toHaveBeenCalledTimes(1)
    })
  })
})
