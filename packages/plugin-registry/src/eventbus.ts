import type { AtcEventBus, AtcEventHandler } from '@atc/events'
import type { AtcPluginCapability } from '@atc/shared-types'
import { AtcPluginPermissionGuard } from '@atc/plugin-runtime'
import { PluginNotFoundError } from './errors.js'

interface TrackedSubscription {
  eventName: string
  handler: AtcEventHandler<unknown>
  // originalHandler is set for once-wrappers so off() can match by original reference
  originalHandler?: AtcEventHandler<unknown>
}

export class AtcPluginScopedEventBus {
  private readonly _subscriptions = new Map<string, TrackedSubscription[]>()

  constructor(private readonly _bus: AtcEventBus) {}

  subscribe(
    pluginId: string,
    capabilities: ReadonlyArray<AtcPluginCapability>,
    eventName: string,
    handler: AtcEventHandler<unknown>,
  ): void {
    const guard = new AtcPluginPermissionGuard(capabilities as string[])
    guard.assertPermission(pluginId, 'events.subscribe')

    this._bus.on(eventName, handler)

    const list = this._subscriptions.get(pluginId) ?? []
    list.push({ eventName, handler })
    this._subscriptions.set(pluginId, list)
  }

  subscribeOnce(
    pluginId: string,
    capabilities: ReadonlyArray<AtcPluginCapability>,
    eventName: string,
    handler: AtcEventHandler<unknown>,
  ): void {
    const guard = new AtcPluginPermissionGuard(capabilities as string[])
    guard.assertPermission(pluginId, 'events.subscribe')

    const list = this._subscriptions.get(pluginId) ?? []

    const wrapper: AtcEventHandler<unknown> = (payload) => {
      // Remove from tracking before invoking — once semantics
      const subs = this._subscriptions.get(pluginId)
      if (subs) {
        const idx = subs.findIndex((s) => s.handler === wrapper)
        if (idx !== -1) subs.splice(idx, 1)
      }
      this._bus.off(eventName, wrapper)
      return handler(payload)
    }

    this._bus.on(eventName, wrapper)
    list.push({ eventName, handler: wrapper, originalHandler: handler })
    this._subscriptions.set(pluginId, list)
  }

  unsubscribe(
    pluginId: string,
    eventName: string,
    handler: AtcEventHandler<unknown>,
  ): void {
    const subs = this._subscriptions.get(pluginId)
    if (!subs) return

    // Match by original handler reference (handles once-wrappers) or direct handler
    const idx = subs.findIndex(
      (s) => s.originalHandler === handler || s.handler === handler,
    )
    if (idx === -1) return

    const sub = subs[idx]!
    this._bus.off(eventName, sub.handler)
    subs.splice(idx, 1)
  }

  async publish(
    pluginId: string,
    capabilities: ReadonlyArray<AtcPluginCapability>,
    eventName: string,
    payload: unknown,
  ): Promise<void> {
    const guard = new AtcPluginPermissionGuard(capabilities as string[])
    guard.assertPermission(pluginId, 'events.publish')

    await this._bus.emit(eventName, payload)
  }

  cleanup(pluginId: string): number {
    const subs = this._subscriptions.get(pluginId)
    if (!subs) return 0

    for (const { eventName, handler } of subs) {
      this._bus.off(eventName, handler)
    }

    const count = subs.length
    this._subscriptions.delete(pluginId)
    return count
  }

  getSubscriptionCount(pluginId: string): number {
    return this._subscriptions.get(pluginId)?.length ?? 0
  }

  getAllSubscriptionCounts(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [id, subs] of this._subscriptions) {
      result[id] = subs.length
    }
    return result
  }
}

export { PluginNotFoundError }
