import type { AtcPluginResourceUsage } from '@atc/shared-types'

export interface ResourceSnapshot extends AtcPluginResourceUsage {
  crashCount: number
  lastCrashAt: string | null
  restartCount: number
  uptimeMs: number
}

export class AtcPluginResourceTracker {
  private _timers = 0
  private _intervals = 0
  private _subscriptions = 0
  private _workers = 0
  private _startedAt: number | null = null
  private _crashCount = 0
  private _lastCrashAt: string | null = null
  private _restartCount = 0

  markStarted(): void {
    this._startedAt = Date.now()
  }

  markStopped(): void {
    this._startedAt = null
  }

  trackTimer(): () => void {
    this._timers++
    return () => { if (this._timers > 0) this._timers-- }
  }

  trackInterval(): () => void {
    this._intervals++
    return () => { if (this._intervals > 0) this._intervals-- }
  }

  trackSubscription(): () => void {
    this._subscriptions++
    return () => { if (this._subscriptions > 0) this._subscriptions-- }
  }

  trackWorker(): () => void {
    this._workers++
    return () => { if (this._workers > 0) this._workers-- }
  }

  recordCrash(error: string): void {
    this._crashCount++
    this._lastCrashAt = new Date().toISOString()
    void error
  }

  recordRestart(): void {
    this._restartCount++
    this._startedAt = null
  }

  resetResources(): void {
    this._timers = 0
    this._intervals = 0
    this._subscriptions = 0
    this._workers = 0
  }

  getSnapshot(): ResourceSnapshot {
    return {
      activeTimers: this._timers,
      activeIntervals: this._intervals,
      activeSubscriptions: this._subscriptions,
      activeWorkers: this._workers,
      estimatedMemoryBytes: 0,
      crashCount: this._crashCount,
      lastCrashAt: this._lastCrashAt,
      restartCount: this._restartCount,
      uptimeMs: this._startedAt !== null ? Date.now() - this._startedAt : 0,
    }
  }

  getCrashCount(): number {
    return this._crashCount
  }

  getRestartCount(): number {
    return this._restartCount
  }
}
