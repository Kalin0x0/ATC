import type { AtcPluginRuntimeStatus, AtcPluginHealthSnapshot } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import { AtcPluginResourceTracker } from './resource-tracker.js'

// Duck-typed interfaces — avoids circular dep (plugin-registry → plugin-runtime)

interface LifecycleManagerLike {
  start(pluginId: string): Promise<void>
  stop(pluginId: string): Promise<void>
  reload(pluginId: string): Promise<void>
  isInflight(pluginId: string): boolean
}

interface PluginRegistryLike {
  get(pluginId: string): { status: AtcPluginRuntimeStatus; lastError: string | null; health: { status: string; restartCount: number } } | undefined
  setStatus(pluginId: string, status: AtcPluginRuntimeStatus, error?: string): void
}

export interface AtcPluginContainerOptions {
  /** Maximum number of crash-restarts before the plugin is auto-disabled (default: 5) */
  maxRestarts?: number
  /** Initial backoff delay in ms before first restart attempt (default: 1_000) */
  initialBackoffMs?: number
  /** Maximum backoff delay in ms (default: 60_000) */
  maxBackoffMs?: number
  /** Backoff multiplier per attempt (default: 2) */
  backoffMultiplier?: number
  telemetry?: AtcTelemetryService
}

export class AtcPluginContainer {
  private readonly _pluginId: string
  private readonly _maxRestarts: number
  private readonly _initialBackoffMs: number
  private readonly _maxBackoffMs: number
  private readonly _backoffMultiplier: number
  private readonly _telemetry: AtcTelemetryService | undefined
  private readonly _tracker: AtcPluginResourceTracker
  private _currentBackoffMs: number
  private _restartTimer: ReturnType<typeof setTimeout> | null = null
  private _stopped = false

  constructor(
    private readonly _lifecycle: LifecycleManagerLike,
    private readonly _registry: PluginRegistryLike,
    pluginId: string,
    options: AtcPluginContainerOptions = {},
  ) {
    this._pluginId = pluginId
    this._maxRestarts = options.maxRestarts ?? 5
    this._initialBackoffMs = options.initialBackoffMs ?? 1_000
    this._maxBackoffMs = options.maxBackoffMs ?? 60_000
    this._backoffMultiplier = options.backoffMultiplier ?? 2
    this._telemetry = options.telemetry
    this._tracker = new AtcPluginResourceTracker()
    this._currentBackoffMs = this._initialBackoffMs
  }

  get pluginId(): string {
    return this._pluginId
  }

  get resourceTracker(): AtcPluginResourceTracker {
    return this._tracker
  }

  async start(): Promise<void> {
    this._stopped = false
    this._tracker.markStarted()
    await this._lifecycle.start(this._pluginId)
    this._resetBackoff()
    this._telemetry?.increment('plugins.active_total')
  }

  async stop(): Promise<void> {
    this._stopped = true
    this._cancelRestartTimer()
    this._tracker.markStopped()
    this._tracker.resetResources()
    await this._lifecycle.stop(this._pluginId)
    this._registry.setStatus(this._pluginId, 'stopped')
    this._telemetry?.increment('plugins.failed_total')
  }

  async reload(): Promise<void> {
    this._cancelRestartTimer()
    this._tracker.recordRestart()
    this._tracker.resetResources()
    await this._lifecycle.reload(this._pluginId)
    this._tracker.markStarted()
    this._resetBackoff()
    this._telemetry?.increment('plugins.reload_total')
  }

  async handleCrash(error: Error): Promise<void> {
    this._tracker.recordCrash(error.message)
    this._telemetry?.increment('plugins.crash_total')

    if (this._tracker.getCrashCount() >= this._maxRestarts) {
      this._registry.setStatus(this._pluginId, 'disabled', error.message)
      this._telemetry?.increment('plugins.auto_disabled_total')
      this._telemetry?.increment('plugins.failed_total')
      return
    }

    this._registry.setStatus(this._pluginId, 'restarting', error.message)
    this._scheduleRestart()
  }

  getHealthSnapshot(): AtcPluginHealthSnapshot {
    const record = this._registry.get(this._pluginId)
    const snap = this._tracker.getSnapshot()
    const healthStatus = record?.health.status

    return {
      pluginId: this._pluginId,
      state: record?.status ?? 'failed',
      healthy: healthStatus === 'healthy',
      uptimeMs: snap.uptimeMs,
      restartCount: snap.restartCount,
      crashCount: snap.crashCount,
      lastError: record?.lastError ?? null,
      lastCrashAt: snap.lastCrashAt,
      resourceUsage: {
        activeTimers: snap.activeTimers,
        activeIntervals: snap.activeIntervals,
        activeSubscriptions: snap.activeSubscriptions,
        activeWorkers: snap.activeWorkers,
        estimatedMemoryBytes: snap.estimatedMemoryBytes,
      },
      capturedAt: new Date().toISOString(),
    }
  }

  private _scheduleRestart(): void {
    if (this._stopped) return
    const delay = this._currentBackoffMs
    this._currentBackoffMs = Math.min(
      this._currentBackoffMs * this._backoffMultiplier,
      this._maxBackoffMs,
    )

    this._restartTimer = setTimeout(() => {
      void this._attemptRestart()
    }, delay)
  }

  private async _attemptRestart(): Promise<void> {
    this._restartTimer = null
    if (this._stopped) return
    try {
      this._tracker.recordRestart()
      this._tracker.resetResources()
      this._tracker.markStarted()
      await this._lifecycle.start(this._pluginId)
      this._resetBackoff()
      this._telemetry?.increment('plugins.restart_total')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      await this.handleCrash(error)
    }
  }

  private _cancelRestartTimer(): void {
    if (this._restartTimer !== null) {
      clearTimeout(this._restartTimer)
      this._restartTimer = null
    }
  }

  private _resetBackoff(): void {
    this._currentBackoffMs = this._initialBackoffMs
  }
}
