import type {
  AtcCreateCharacterRequest,
  AtcCreateCharacterResponse,
  AtcCharacterListResponse,
  AtcCharacter,
  AtcCharacterSelectResponse,
} from '@atc/shared-types'
import type { AtcHttpClient } from './http-client.js'

export class AtcCharactersSDK {
  constructor(private readonly http: AtcHttpClient) {}

  async create(request: AtcCreateCharacterRequest): Promise<AtcCreateCharacterResponse | null> {
    const res = await this.http.post<AtcCreateCharacterResponse>('/api/v1/characters', request)
    if (!res.ok || !res.data) return null
    return res.data
  }

  async listByAccount(accountId: string): Promise<AtcCharacterListResponse | null> {
    const encoded = encodeURIComponent(accountId)
    const res = await this.http.get<AtcCharacterListResponse>(`/api/v1/characters/account/${encoded}`)
    if (!res.ok || !res.data) return null
    return res.data
  }

  async get(characterId: string): Promise<AtcCharacter | null> {
    const encoded = encodeURIComponent(characterId)
    const res = await this.http.get<AtcCharacter>(`/api/v1/characters/${encoded}`)
    if (!res.ok || !res.data) return null
    return res.data
  }

  async selectForSession(sessionId: string, characterId: string): Promise<AtcCharacterSelectResponse | null> {
    const encodedSession = encodeURIComponent(sessionId)
    const res = await this.http.patch<AtcCharacterSelectResponse>(
      `/api/v1/sessions/${encodedSession}/character`,
      { characterId }
    )
    if (!res.ok || !res.data) return null
    return res.data
  }
}
