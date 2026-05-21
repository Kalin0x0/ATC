import type {
  AtcPluginEventsApi,
  AtcPluginApiResult,
  AtcPluginCapability,
} from '@atc/shared-types'
import type { AtcPluginScopedEventBus } from '@atc/plugin-registry'
import type { AtcPluginRegistry } from '@atc/plugin-registry'

export class PluginEventsApi implements AtcPluginEventsApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _scopedBus: AtcPluginScopedEventBus,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  on(event: string, handler: (payload: unknown) => void): void {
    this._registry.incrementApiCall(this._pluginId)
    // AtcPermissionDeniedError thrown by the scoped bus if capability missing
    this._scopedBus.subscribe(this._pluginId, this._capabilities, event, handler)
  }

  once(event: string, handler: (payload: unknown) => void): void {
    this._registry.incrementApiCall(this._pluginId)
    this._scopedBus.subscribeOnce(this._pluginId, this._capabilities, event, handler)
  }

  off(event: string, handler: (payload: unknown) => void): void {
    this._scopedBus.unsubscribe(this._pluginId, event, handler)
  }

  async emit(event: string, payload?: unknown): Promise<AtcPluginApiResult<void>> {
    if (!this._capabilities.includes('events.publish')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: events.publish required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      await this._scopedBus.publish(this._pluginId, this._capabilities, event, payload)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Event emit failed' }
    }
  }
}
