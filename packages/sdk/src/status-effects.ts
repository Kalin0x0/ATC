import type { AtcHttpClient } from './http-client.js'
import type {
  AtcStatusEffect,
  AtcApplyStatusEffectRequest,
  AtcStatusEffectsResponse,
  AtcStatusEffectType,
} from '@atc/shared-types'

export class AtcStatusEffectsSDK {
  constructor(private readonly http: AtcHttpClient) {}

  async list(characterId: string): Promise<AtcStatusEffectsResponse | null> {
    const res = await this.http.get<AtcStatusEffectsResponse>(
      `/api/v1/status-effects/character/${characterId}`,
    )
    return res.ok ? res.data : null
  }

  async apply(
    characterId: string,
    request: AtcApplyStatusEffectRequest,
  ): Promise<AtcStatusEffect | null> {
    const res = await this.http.post<AtcStatusEffect>(
      `/api/v1/status-effects/character/${characterId}`,
      request,
    )
    return res.ok ? res.data : null
  }

  async clear(
    characterId: string,
    type: AtcStatusEffectType,
  ): Promise<boolean> {
    const res = await this.http.delete<void>(
      `/api/v1/status-effects/character/${characterId}/${type}`,
    )
    return res.ok
  }

  async clearAll(characterId: string): Promise<boolean> {
    const res = await this.http.delete<void>(
      `/api/v1/status-effects/character/${characterId}`,
    )
    return res.ok
  }
}
