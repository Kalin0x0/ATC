import type { AtcHttpClient } from './http-client.js'
import type {
  AtcCharacterVitals,
  AtcVitalsPatch,
  AtcVitalsMutationRequest,
} from '@atc/shared-types'

export class AtcVitalsSDK {
  constructor(private readonly http: AtcHttpClient) {}

  async get(characterId: string): Promise<AtcCharacterVitals | null> {
    const res = await this.http.get<AtcCharacterVitals>(
      `/api/v1/vitals/character/${characterId}`,
    )
    return res.ok ? res.data : null
  }

  async patch(
    characterId: string,
    patch: AtcVitalsPatch,
  ): Promise<AtcCharacterVitals | null> {
    const res = await this.http.patch<AtcCharacterVitals>(
      `/api/v1/vitals/character/${characterId}`,
      patch,
    )
    return res.ok ? res.data : null
  }

  async mutate(
    characterId: string,
    request: AtcVitalsMutationRequest,
  ): Promise<AtcCharacterVitals | null> {
    const res = await this.http.post<AtcCharacterVitals>(
      `/api/v1/vitals/character/${characterId}/mutate`,
      request,
    )
    return res.ok ? res.data : null
  }

  async reset(characterId: string): Promise<AtcCharacterVitals | null> {
    const res = await this.http.post<AtcCharacterVitals>(
      `/api/v1/vitals/character/${characterId}/reset`,
      {},
    )
    return res.ok ? res.data : null
  }
}
