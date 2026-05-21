import type { AtcPluginCleanupRegistrar } from '@atc/shared-types'

export class PluginCleanupManager implements AtcPluginCleanupRegistrar {
  private readonly _callbacks: Array<() => void> = []
  private readonly _timeouts = new Set<ReturnType<typeof setTimeout>>()
  private readonly _intervals = new Set<ReturnType<typeof setInterval>>()
  private _disposed = false

  onCleanup(fn: () => void): void {
    if (this._disposed) return
    this._callbacks.push(fn)
  }

  scheduleTimeout(fn: () => void, ms: number): void {
    if (this._disposed) return
    const id = setTimeout(() => {
      this._timeouts.delete(id)
      try { fn() } catch { /* plugin timers are best-effort */ }
    }, ms)
    this._timeouts.add(id)
  }

  scheduleInterval(fn: () => void, ms: number): void {
    if (this._disposed) return
    const id = setInterval(() => {
      try { fn() } catch { /* plugin intervals are best-effort */ }
    }, ms)
    this._intervals.add(id)
  }

  activeTimers(): number {
    return this._timeouts.size
  }

  activeIntervals(): number {
    return this._intervals.size
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    for (const id of this._timeouts) clearTimeout(id)
    this._timeouts.clear()

    for (const id of this._intervals) clearInterval(id)
    this._intervals.clear()

    for (const fn of this._callbacks) {
      try { fn() } catch { /* best-effort */ }
    }
    this._callbacks.length = 0
  }
}
