import type {
  AtcPluginStatusEffectsApi,
  AtcPluginApiResult,
  AtcPluginCapability,
  AtcStatusEffect,
  AtcApplyStatusEffectRequest,
} from '@atc/shared-types'
import type { AtcPluginRegistry } from '@atc/plugin-registry'

interface StatusEffectsServiceLike {
  getEffects(characterId: string): Promise<AtcStatusEffect[]>
  applyEffect(characterId: string, request: AtcApplyStatusEffectRequest): Promise<void>
  clearEffect(characterId: string, type: string): Promise<void>
}

export class PluginStatusEffectsApi implements AtcPluginStatusEffectsApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _service: StatusEffectsServiceLike,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  async read(characterId: string): Promise<AtcPluginApiResult<readonly AtcStatusEffect[]>> {
    if (!this._capabilities.includes('status.read')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: status.read required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.getEffects(characterId)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Status effects read failed' }
    }
  }

  async apply(
    characterId: string,
    request: AtcApplyStatusEffectRequest,
  ): Promise<AtcPluginApiResult<void>> {
    if (!this._capabilities.includes('status.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: status.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      await this._service.applyEffect(characterId, request)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Status effect apply failed' }
    }
  }

  async clear(characterId: string, type: string): Promise<AtcPluginApiResult<void>> {
    if (!this._capabilities.includes('status.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: status.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      await this._service.clearEffect(characterId, type)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Status effect clear failed' }
    }
  }
}
