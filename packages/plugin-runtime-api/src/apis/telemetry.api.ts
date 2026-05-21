import type { AtcPluginTelemetryApi, AtcPluginCapability } from '@atc/shared-types'
import type { AtcTelemetryService } from '@atc/telemetry'
import type { AtcPluginRegistry } from '@atc/plugin-registry'

export class PluginTelemetryApi implements AtcPluginTelemetryApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _telemetry: AtcTelemetryService,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  record(name: string, value: number, kind: 'counter' | 'gauge' | 'histogram' = 'counter'): void {
    if (!this._capabilities.includes('telemetry.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return
    }
    this._registry.incrementApiCall(this._pluginId)
    const prefixed = `plugin.${this._pluginId}.${name}`
    try {
      if (kind === 'gauge') {
        this._telemetry.gauge(prefixed, value)
      } else if (kind === 'histogram') {
        this._telemetry.histogram(prefixed, value)
      } else {
        this._telemetry.increment(prefixed, value)
      }
    } catch { /* telemetry is best-effort */ }
  }

  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      this.record(`${name}.duration_ms`, performance.now() - start, 'histogram')
      return result
    } catch (err) {
      this.record(`${name}.error`, 1, 'counter')
      throw err
    }
  }
}
