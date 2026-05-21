import type { AtcHttpClient } from './http-client.js'
import type {
  AtcInventoryResponse,
  AtcInventoryMutationResponse,
  AtcInventoryTransaction,
  AtcInventoryAddRequest,
  AtcInventoryRemoveRequest,
  AtcInventoryMoveRequest,
  AtcInventorySettings,
  AtcItemUseRequest,
  AtcItemUseResponse,
} from '@atc/shared-types'

export interface AtcUpdateSettingsRequest {
  maxSlots?: number
  maxWeightGrams?: number
}

export class AtcInventorySDK {
  constructor(private readonly http: AtcHttpClient) {}

  async get(characterId: string): Promise<AtcInventoryResponse | null> {
    const res = await this.http.get<AtcInventoryResponse>(
      `/api/v1/inventory/character/${characterId}`,
    )
    return res.ok ? res.data : null
  }

  async addItem(
    characterId: string,
    params: AtcInventoryAddRequest,
  ): Promise<AtcInventoryMutationResponse | null> {
    const res = await this.http.post<AtcInventoryMutationResponse>(
      `/api/v1/inventory/character/${characterId}/add`,
      params,
    )
    return res.ok ? res.data : null
  }

  async removeItem(
    characterId: string,
    params: AtcInventoryRemoveRequest,
  ): Promise<AtcInventoryMutationResponse | null> {
    const res = await this.http.post<AtcInventoryMutationResponse>(
      `/api/v1/inventory/character/${characterId}/remove`,
      params,
    )
    return res.ok ? res.data : null
  }

  async moveItem(
    characterId: string,
    params: AtcInventoryMoveRequest,
  ): Promise<AtcInventoryMutationResponse | null> {
    const res = await this.http.post<AtcInventoryMutationResponse>(
      `/api/v1/inventory/character/${characterId}/move`,
      params,
    )
    return res.ok ? res.data : null
  }

  async listTransactions(
    characterId: string,
    limit = 50,
    offset = 0,
  ): Promise<AtcInventoryTransaction[]> {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    const res = await this.http.get<AtcInventoryTransaction[]>(
      `/api/v1/inventory/character/${characterId}/transactions?${qs.toString()}`,
    )
    return (res.ok && res.data) ? res.data : []
  }

  async getSettings(characterId: string): Promise<AtcInventorySettings | null> {
    const res = await this.http.get<AtcInventorySettings>(
      `/api/v1/inventory/character/${characterId}/settings`,
    )
    return res.ok ? res.data : null
  }

  async updateSettings(
    characterId: string,
    params: AtcUpdateSettingsRequest,
  ): Promise<AtcInventorySettings | null> {
    const res = await this.http.patch<AtcInventorySettings>(
      `/api/v1/inventory/character/${characterId}/settings`,
      params,
    )
    return res.ok ? res.data : null
  }

  async useItem(
    characterId: string,
    request: AtcItemUseRequest,
  ): Promise<AtcItemUseResponse | null> {
    const res = await this.http.post<AtcItemUseResponse>(
      `/api/v1/inventory/character/${characterId}/use`,
      request,
    )
    return res.ok ? res.data : null
  }
}
