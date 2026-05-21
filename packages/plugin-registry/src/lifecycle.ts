import type { AtcPluginHooks, AtcPluginServiceContainer, AtcPluginCapability } from '@atc/shared-types'
import type { AtcPluginRegistry } from './registry.js'
import type { AtcPluginHealthMonitor } from './health.js'
import type { AtcPluginScopedEventBus } from './eventbus.js'
import {
  PluginNotFoundError,
  PluginLifecycleTimeoutError,
  PluginConcurrentOperationError,
} from './errors.js'
import { AtcEventBus } from '@atc/events'

interface PluginStateLike {
  load(pluginId: string): Promise<{ enabled: boolean; crashCount: number } | undefined>
  setEnabled(pluginId: string, enabled: boolean): Promise<void>
  incrementCrashCount(pluginId: string): Promise<number>
}

export interface AtcPluginLifecycleManagerOptions {
  timeoutMs?: number
  maxFailures?: number
  pluginState?: PluginStateLike
  scopedEventBus?: AtcPluginScopedEventBus
  containerFactory?: (
    pluginId: string,
    capabilities: ReadonlyArray<AtcPluginCapability>,
  ) => AtcPluginServiceContainer
}

// Throws PluginLifecycleTimeoutError directly — avoids fragile string-prefix detection.
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  pluginId: string,
  hookName: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new PluginLifecycleTimeoutError(pluginId, hookName, ms)),
      ms,
    )
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e: unknown) => { clearTimeout(timer); reject(e) },
    )
  })
}

export class AtcPluginLifecycleManager {
  private readonly _hooks = new Map<string, AtcPluginHooks>()
  private readonly _cleanupFns = new Map<string, Array<() => void>>()
  private readonly _containers = new Map<string, AtcPluginServiceContainer>()
  // Per-plugin in-flight guard: prevents concurrent start/stop/reload on the same plugin.
  private readonly _inflight = new Set<string>()

  private readonly _timeoutMs: number
  private readonly _pluginState: PluginStateLike | undefined
  private readonly _scopedEventBus: AtcPluginScopedEventBus | undefined
  private readonly _containerFactory:
    | ((pluginId: string, capabilities: ReadonlyArray<AtcPluginCapability>) => AtcPluginServiceContainer)
    | undefined

  constructor(
    private readonly _registry: AtcPluginRegistry,
    private readonly _health: AtcPluginHealthMonitor,
    private readonly _eventBus: AtcEventBus,
    options: AtcPluginLifecycleManagerOptions = {},
  ) {
    this._timeoutMs = options.timeoutMs ?? 10_000
    this._pluginState = options.pluginState
    this._scopedEventBus = options.scopedEventBus
    this._containerFactory = options.containerFactory
  }

  registerHooks(id: string, hooks: AtcPluginHooks): void {
    if (!this._registry.has(id)) throw new PluginNotFoundError(id)
    this._hooks.set(id, { ...hooks })
  }

  addCleanup(id: string, fn: () => void): void {
    const list = this._cleanupFns.get(id) ?? []
    list.push(fn)
    this._cleanupFns.set(id, list)
  }

  isInflight(id: string): boolean {
    return this._inflight.has(id)
  }

  getContainer(id: string): AtcPluginServiceContainer | undefined {
    return this._containers.get(id)
  }

  // ── Public API (all guarded against concurrent calls for the same plugin) ────

  async start(id: string): Promise<void> {
    if (this._inflight.has(id)) throw new PluginConcurrentOperationError(id)
    this._inflight.add(id)
    try {
      await this._doStart(id)
    } finally {
      this._inflight.delete(id)
    }
  }

  async stop(id: string): Promise<void> {
    if (this._inflight.has(id)) throw new PluginConcurrentOperationError(id)
    this._inflight.add(id)
    try {
      await this._doStop(id)
    } finally {
      this._inflight.delete(id)
    }
  }

  async reload(id: string): Promise<void> {
    if (this._inflight.has(id)) throw new PluginConcurrentOperationError(id)
    this._inflight.add(id)
    try {
      await this._doReload(id)
    } finally {
      this._inflight.delete(id)
    }
  }

  async reloadAll(): Promise<void> {
    const order = this._registry.getLoadOrder()

    // Stop in reverse dependency order
    for (const id of [...order].reverse()) {
      if (this._inflight.has(id)) continue
      this._inflight.add(id)
      try {
        const r = this._registry.get(id)
        if (r?.status === 'active') {
          await this._doStop(id).catch(() => undefined)
        }
      } finally {
        this._inflight.delete(id)
      }
    }

    // Start in dependency order
    for (const id of order) {
      if (this._inflight.has(id)) continue
      this._inflight.add(id)
      try {
        await this._doStart(id).catch(() => undefined)
      } finally {
        this._inflight.delete(id)
      }
    }
  }

  async destroy(id: string): Promise<void> {
    if (this._inflight.has(id)) throw new PluginConcurrentOperationError(id)
    this._inflight.add(id)
    try {
      const record = this._registry.get(id)
      if (!record) throw new PluginNotFoundError(id)

      // Stop the plugin if it's in any in-progress or active state
      if (
        record.status === 'active' ||
        record.status === 'loading' ||
        record.status === 'unloading'
      ) {
        await this._doStop(id).catch(() => undefined)
      }

      this._hooks.delete(id)
      this._cleanupFns.delete(id)
      this._health.remove(id)
      this._registry.unregister(id)
    } finally {
      this._inflight.delete(id)
    }
  }

  // ── Private implementations (no in-flight guard — callers hold the lock) ─────

  private async _doStart(id: string): Promise<void> {
    const record = this._registry.get(id)
    if (!record) throw new PluginNotFoundError(id)

    // Restore enabled state: skip starting if plugin was explicitly disabled
    if (this._pluginState) {
      const persisted = await this._pluginState.load(id).catch(() => undefined)
      if (persisted && !persisted.enabled) {
        this._registry.setStatus(id, 'disabled')
        return
      }
    }

    const startLoad = performance.now()
    this._registry.setStatus(id, 'loading')

    try {
      // Build and inject service container before onLoad
      if (this._containerFactory) {
        const container = this._containerFactory(id, record.capabilities)
        this._containers.set(id, container)
        await this._runSetup(id, container)
      }

      await this._runHook(id, 'onLoad')
      this._registry.updateLifecycleMetric(id, 'loadTimeMs', performance.now() - startLoad)

      const startEnable = performance.now()
      await this._runHook(id, 'onEnable')
      this._registry.updateLifecycleMetric(id, 'enableTimeMs', performance.now() - startEnable)

      this._registry.setStatus(id, 'active')
      this._health.recordSuccess(id)
      this._health.resetFailures(id)

      // Persist success state
      if (this._pluginState) {
        this._pluginState.setEnabled(id, true).catch(() => undefined)
      }

      this._eventBus.emit('atc:plugin:started', { pluginId: id }).catch(() => undefined)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      this._registry.setStatus(id, 'failed', errMsg)

      // Persist crash
      if (this._pluginState) {
        this._pluginState.incrementCrashCount(id).catch(() => undefined)
      }

      const result = this._health.recordFailure(id, errMsg)
      if (result.shouldDisable) {
        this._registry.setStatus(id, 'disabled', errMsg)
        this._eventBus.emit('atc:plugin:disabled', { pluginId: id, reason: errMsg }).catch(() => undefined)
      }

      this._eventBus.emit('atc:plugin:failed', { pluginId: id, error: errMsg }).catch(() => undefined)
      throw err
    }
  }

  private async _doStop(id: string): Promise<void> {
    const record = this._registry.get(id)
    if (!record) throw new PluginNotFoundError(id)

    const startDisable = performance.now()
    this._registry.setStatus(id, 'unloading')

    try {
      await this._runHook(id, 'onDisable').catch(() => undefined)
      this._registry.updateLifecycleMetric(id, 'disableTimeMs', performance.now() - startDisable)

      const startUnload = performance.now()
      await this._runHook(id, 'onUnload').catch(() => undefined)
      this._registry.updateLifecycleMetric(id, 'unloadTimeMs', performance.now() - startUnload)
    } finally {
      // Dispose service container cleanup (timers/intervals/callbacks)
      const container = this._containers.get(id)
      if (container) {
        try { container.cleanup.dispose() } catch { /* best-effort */ }
        this._containers.delete(id)
      }

      // Remove all scoped EventBus subscriptions for this plugin
      if (this._scopedEventBus) {
        this._scopedEventBus.cleanup(id)
      }

      this._runCleanup(id)
      this._registry.setStatus(id, 'disabled')
    }
  }

  private async _doReload(id: string): Promise<void> {
    const record = this._registry.get(id)
    if (!record) throw new PluginNotFoundError(id)

    // Stop if running or mid-lifecycle; skip if already stopped/failed/registered
    if (
      record.status === 'active' ||
      record.status === 'loading' ||
      record.status === 'unloading'
    ) {
      await this._doStop(id).catch(() => undefined)
    }

    // Capture reloadCount BEFORE resetMetrics clears it
    const prevReloadCount = this._registry.get(id)?.lifecycleMetrics.reloadCount ?? 0

    this._registry.resetMetrics(id)
    this._health.incrementRestartCount(id)
    this._registry.updateLifecycleMetric(id, 'reloadCount', prevReloadCount + 1)

    await this._doStart(id)

    this._eventBus.emit('atc:plugin:reloaded', { pluginId: id }).catch(() => undefined)
  }

  private async _runSetup(id: string, container: AtcPluginServiceContainer): Promise<void> {
    const hooks = this._hooks.get(id)
    const hook = hooks?.onSetup
    if (!hook) return

    try {
      const result = hook(container)
      if (result instanceof Promise) {
        await withTimeout(result, this._timeoutMs, id, 'onSetup')
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      if (!(err instanceof PluginLifecycleTimeoutError)) {
        try {
          const onError = hooks?.onError
          if (onError) {
            const errResult = onError(error)
            if (errResult instanceof Promise) await errResult.catch(() => undefined)
          }
        } catch { /* onError itself failed — swallow */ }
      }

      throw err
    }
  }

  private async _runHook(
    id: string,
    hookName: keyof Omit<AtcPluginHooks, 'onError' | 'onSetup'>,
  ): Promise<void> {
    const hooks = this._hooks.get(id)
    const hook = hooks?.[hookName]
    if (!hook) return

    try {
      const result = hook()
      if (result instanceof Promise) {
        await withTimeout(result, this._timeoutMs, id, hookName)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))

      // Don't invoke onError for lifecycle infrastructure errors (timeouts, concurrent ops)
      if (!(err instanceof PluginLifecycleTimeoutError)) {
        try {
          const onError = hooks?.onError
          if (onError) {
            const errResult = onError(error)
            if (errResult instanceof Promise) await errResult.catch(() => undefined)
          }
        } catch {
          // onError itself failed — swallow
        }
      }

      throw err
    }
  }

  private _runCleanup(id: string): void {
    const fns = this._cleanupFns.get(id) ?? []
    for (const fn of fns) {
      try { fn() } catch { /* cleanup is best-effort */ }
    }
    this._cleanupFns.delete(id)
  }
}
