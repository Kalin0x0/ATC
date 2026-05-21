import type {
  AtcPluginVitalsApi,
  AtcPluginApiResult,
  AtcPluginCapability,
  AtcCharacterVitals,
  AtcVitalsPatch,
} from '@atc/shared-types'
import type { AtcPluginRegistry } from '@atc/plugin-registry'

interface VitalsServiceLike {
  get(characterId: string): Promise<AtcCharacterVitals | undefined>
  mutate(
    characterId: string,
    patch: AtcVitalsPatch,
    source: string,
    actor: string,
  ): Promise<AtcCharacterVitals>
}

export class PluginVitalsApi implements AtcPluginVitalsApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _service: VitalsServiceLike,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  async read(characterId: string): Promise<AtcPluginApiResult<AtcCharacterVitals>> {
    if (!this._capabilities.includes('vitals.read')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: vitals.read required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.get(characterId)
      if (!data) return { ok: false, error: 'Character vitals not found' }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Vitals read failed' }
    }
  }

  async mutate(
    characterId: string,
    patch: AtcVitalsPatch,
  ): Promise<AtcPluginApiResult<AtcCharacterVitals>> {
    if (!this._capabilities.includes('vitals.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: vitals.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.mutate(characterId, patch, 'plugin', this._pluginId)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Vitals mutate failed' }
    }
  }
}
