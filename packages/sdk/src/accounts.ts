import type { AtcAccountUpsertRequest, AtcAccountUpsertResponse, AtcBanCheckResponse } from '@atc/shared-types'
import type { AtcHttpClient } from './http-client.js'

export class AtcAccountsSDK {
  constructor(private readonly http: AtcHttpClient) {}

  async upsert(
    request: AtcAccountUpsertRequest
  ): Promise<AtcAccountUpsertResponse | null> {
    const res = await this.http.post<AtcAccountUpsertResponse>('/api/v1/accounts', request)
    if (!res.ok || !res.data) return null
    return res.data
  }

  async checkBan(identifier: string): Promise<AtcBanCheckResponse | null> {
    const encoded = encodeURIComponent(identifier)
    const res = await this.http.get<AtcBanCheckResponse>(`/api/v1/accounts/check/${encoded}`)
    if (!res.ok || !res.data) return null
    return res.data
  }
}
