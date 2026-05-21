import type { AtcEventBusMetrics } from '@atc/shared-types'

export type AtcEventName = string

export type AtcEventHandler<TPayload = unknown> = (payload: TPayload) => void | Promise<void>

export interface AtcEventEmitResult {
  name: string
  handlersInvoked: number
  failures: Array<{ error: unknown }>
}

export interface AtcEventBusOptions {
  metricsEnabled?: boolean
}

export type { AtcEventBusMetrics }

export class AtcEventBus {
  private readonly _handlers = new Map<string, Array<AtcEventHandler<unknown>>>()
  private readonly _metricsEnabled: boolean
  private _emittedTotal = 0
  private _handledTotal = 0
  private _failedTotal = 0
  private _totalDurationMs = 0

  constructor(options: AtcEventBusOptions = {}) {
    this._metricsEnabled = options.metricsEnabled ?? true
  }

  on<TPayload = unknown>(name: AtcEventName, handler: AtcEventHandler<TPayload>): void {
    const list = this._handlers.get(name) ?? []
    list.push(handler as AtcEventHandler<unknown>)
    this._handlers.set(name, list)
  }

  once<TPayload = unknown>(name: AtcEventName, handler: AtcEventHandler<TPayload>): void {
    const wrapper: AtcEventHandler<unknown> = (payload) => {
      this.off(name, wrapper as AtcEventHandler<TPayload>)
      return (handler as AtcEventHandler<unknown>)(payload)
    }
    this.on(name, wrapper as AtcEventHandler<TPayload>)
  }

  off<TPayload = unknown>(name: AtcEventName, handler: AtcEventHandler<TPayload>): void {
    const list = this._handlers.get(name)
    if (!list) return
    const updated = list.filter((h) => h !== (handler as AtcEventHandler<unknown>))
    if (updated.length === 0) {
      this._handlers.delete(name)
    } else {
      this._handlers.set(name, updated)
    }
  }

  async emit<TPayload = unknown>(name: AtcEventName, payload: TPayload): Promise<AtcEventEmitResult> {
    const list = this._handlers.get(name) ?? []
    const failures: Array<{ error: unknown }> = []

    const startMs = this._metricsEnabled ? performance.now() : 0
    if (this._metricsEnabled) this._emittedTotal++

    for (const handler of list) {
      try {
        await handler(payload)
        if (this._metricsEnabled) this._handledTotal++
      } catch (error) {
        failures.push({ error })
        if (this._metricsEnabled) this._failedTotal++
      }
    }

    if (this._metricsEnabled && list.length > 0) {
      this._totalDurationMs += performance.now() - startMs
    }

    return { name, handlersInvoked: list.length, failures }
  }

  getMetrics(): AtcEventBusMetrics {
    const activeSubscribers = Array.from(this._handlers.values())
      .reduce((sum, list) => sum + list.length, 0)
    const avgDurationMs = this._emittedTotal > 0
      ? Math.round((this._totalDurationMs / this._emittedTotal) * 100) / 100
      : 0
    return {
      emittedTotal: this._emittedTotal,
      handledTotal: this._handledTotal,
      failedTotal: this._failedTotal,
      avgDurationMs,
      activeSubscribers,
      metricsEnabled: this._metricsEnabled,
    }
  }

  listenerCount(name: AtcEventName): number {
    return this._handlers.get(name)?.length ?? 0
  }

  eventNames(): string[] {
    return Array.from(this._handlers.keys())
  }
}
