import type { AtcPluginCapability, AtcPluginMetrics } from '@atc/shared-types'
import { AtcPluginPermissionGuard } from './guard.js'
import { AtcPermissionDeniedError } from './types.js'

export interface AtcPluginRuntimeOptions {
  pluginId: string
  capabilities: ReadonlyArray<string>
  logger?: {
    warn: (obj: Record<string, unknown>, msg: string) => void
  }
}

export class AtcPluginRuntime {
  private readonly _pluginId: string
  private readonly _guard: AtcPluginPermissionGuard
  private readonly _logger?: AtcPluginRuntimeOptions['logger']
  private _eventsPublished = 0
  private _eventsSubscribed = 0
  private _permissionDenied = 0
  private readonly _registeredAt: string

  constructor(options: AtcPluginRuntimeOptions) {
    this._pluginId = options.pluginId
    this._guard = new AtcPluginPermissionGuard(options.capabilities)
    this._logger = options.logger
    this._registeredAt = new Date().toISOString()
  }

  get pluginId(): string {
    return this._pluginId
  }

  hasPermission(capability: AtcPluginCapability): boolean {
    return this._guard.hasPermission(capability)
  }

  assertPermission(capability: AtcPluginCapability): void {
    try {
      this._guard.assertPermission(this._pluginId, capability)
    } catch (err) {
      if (err instanceof AtcPermissionDeniedError) {
        this._permissionDenied++
        this._logger?.warn({ pluginId: this._pluginId, capability }, 'plugin permission denied')
      }
      throw err
    }
  }

  assertAnyPermission(capabilities: AtcPluginCapability[]): void {
    try {
      this._guard.assertAnyPermission(this._pluginId, capabilities)
    } catch (err) {
      if (err instanceof AtcPermissionDeniedError) {
        this._permissionDenied++
        this._logger?.warn({ pluginId: this._pluginId, capabilities }, 'plugin permission denied')
      }
      throw err
    }
  }

  trackEventPublished(): void {
    this._eventsPublished++
  }

  trackEventSubscribed(): void {
    this._eventsSubscribed++
  }

  getMetrics(): AtcPluginMetrics {
    return {
      pluginId: this._pluginId,
      eventsPublished: this._eventsPublished,
      eventsSubscribed: this._eventsSubscribed,
      permissionDeniedCount: this._permissionDenied,
      registeredAt: this._registeredAt,
    }
  }
}
