import type {
  AtcPluginWalletApi,
  AtcPluginApiResult,
  AtcPluginCapability,
  AtcWallet,
} from '@atc/shared-types'
import type { AtcPluginRegistry } from '@atc/plugin-registry'

interface WalletServiceLike {
  getWallet(characterId: string): Promise<AtcWallet | undefined>
  credit(characterId: string, amount: number, reason: string, source: string): Promise<AtcWallet>
  debit(characterId: string, amount: number, reason: string, source: string): Promise<AtcWallet>
}

export class PluginWalletApi implements AtcPluginWalletApi {
  constructor(
    private readonly _pluginId: string,
    private readonly _capabilities: ReadonlyArray<AtcPluginCapability>,
    private readonly _service: WalletServiceLike,
    private readonly _registry: AtcPluginRegistry,
  ) {}

  async balance(characterId: string): Promise<AtcPluginApiResult<AtcWallet>> {
    if (!this._capabilities.includes('wallet.read')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: wallet.read required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.getWallet(characterId)
      if (!data) return { ok: false, error: 'Wallet not found' }
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Wallet read failed' }
    }
  }

  async credit(
    characterId: string,
    amount: number,
    reason: string,
  ): Promise<AtcPluginApiResult<AtcWallet>> {
    if (!this._capabilities.includes('wallet.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: wallet.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.credit(characterId, amount, reason, this._pluginId)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Wallet credit failed' }
    }
  }

  async debit(
    characterId: string,
    amount: number,
    reason: string,
  ): Promise<AtcPluginApiResult<AtcWallet>> {
    if (!this._capabilities.includes('wallet.write')) {
      this._registry.incrementDeniedCall(this._pluginId)
      return { ok: false, error: 'Permission denied: wallet.write required' }
    }
    this._registry.incrementApiCall(this._pluginId)
    try {
      const data = await this._service.debit(characterId, amount, reason, this._pluginId)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Wallet debit failed' }
    }
  }
}
