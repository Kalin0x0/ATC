import type { AtcSessionCreateRequest, AtcSessionResponse } from '@atc/shared-types'
import type { AtcHttpClient } from './http-client.js'

export class AtcSessionsSDK {
  constructor(private readonly http: AtcHttpClient) {}

  async create(request: AtcSessionCreateRequest): Promise<AtcSessionResponse | null> {
    const res = await this.http.post<AtcSessionResponse>('/api/v1/sessions', request)
    if (!res.ok || !res.data) return null
    return res.data
  }

  async end(source: number): Promise<boolean> {
    const res = await this.http.delete<null>(`/api/v1/sessions/${source}`)
    return res.ok
  }

  async getBySource(source: number): Promise<AtcSessionResponse | null> {
    const res = await this.http.get<AtcSessionResponse>(`/api/v1/sessions/source/${source}`)
    if (!res.ok || !res.data) return null
    return res.data
  }
}
