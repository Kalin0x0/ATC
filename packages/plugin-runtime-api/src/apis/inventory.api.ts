import type {
  AtcPluginInventoryApi,
  AtcPluginApiResult,
  AtcPluginCapability,
  AtcInventorySlot,
} from '@atc/shared-types'
import type { AtcPluginRegistry } from '@atc/plugin-registry'

interface InventoryServiceLike {
  getSlots(characterId: string): Promise<AtcInventorySlot[]>
  addItem(
    characterId: string,
    itemId: string,
    quantity: number,
    metadata?: Record<string, unknown>,
  ): Promise<void>
  removeItem(characterId: string, itemId: string, quantity: number): Promise<void>
}

export class PluginInventoryApi implements AtcPluginInventoryApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _service: InventoryServiceLike,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  async read(characterId: string): Promise<AtcPluginApiResult<readonly AtcInventorySlot[]>> {
    if (!this._capabilities.includes('inventory.read')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: inventory.read required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.getSlots(characterId)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Inventory read failed' }
    }
  }

  async add(
    characterId: string,
    itemId: string,
    quantity: number,
    metadata?: Record<string, unknown>,
  ): Promise<AtcPluginApiResult<void>> {
    if (!this._capabilities.includes('inventory.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: inventory.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      await this._service.addItem(characterId, itemId, quantity, metadata)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Inventory add failed' }
    }
  }

  async remove(
    characterId: string,
    itemId: string,
    quantity: number,
  ): Promise<AtcPluginApiResult<void>> {
    if (!this._capabilities.includes('inventory.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: inventory.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      await this._service.removeItem(characterId, itemId, quantity)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Inventory remove failed' }
    }
  }
}
