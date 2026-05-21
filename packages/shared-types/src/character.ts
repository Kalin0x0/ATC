export type AtcGender = 'male' | 'female' | 'other'
export type AtcCharacterStatus = 'active' | 'deleted' | 'suspended'

export interface AtcCharacter {
  id: string
  accountId: string
  slot: number
  firstName: string
  lastName: string
  dateOfBirth: string | null
  nationality: string | null
  gender: AtcGender
  metadata: Record<string, unknown>
  status: AtcCharacterStatus
  createdAt: Date
  updatedAt: Date
}

export interface AtcCharacterSummary {
  id: string
  slot: number
  firstName: string
  lastName: string
  status: AtcCharacterStatus
  dateOfBirth: string | null
  gender: AtcGender
  nationality: string | null
}

// Phase 1 legacy DTO — preserved for internal SDK compatibility
export interface AtcCreateCharacterDto {
  accountId: string
  firstName: string
  lastName: string
  dateOfBirth: string
  nationality: string
  gender: AtcGender
}

// Phase 3 REST API types
export interface AtcCreateCharacterRequest {
  accountId: string
  slot: number
  firstName: string
  lastName: string
  dateOfBirth?: string
  gender: AtcGender
  nationality?: string
  metadata?: Record<string, unknown>
}

export interface AtcCreateCharacterResponse {
  characterId: string
  slot: number
  firstName: string
  lastName: string
  status: AtcCharacterStatus
  created: boolean
}

export interface AtcCharacterListResponse {
  characters: AtcCharacterSummary[]
}

export interface AtcCharacterSelectRequest {
  characterId: string
}

export interface AtcCharacterSelectResponse {
  sessionId: string
  characterId: string
  accountId: string
  firstName: string
  lastName: string
  status: AtcCharacterStatus
}

export function getCharacterFullName(character: Pick<AtcCharacter, 'firstName' | 'lastName'>): string {
  return `${character.firstName} ${character.lastName}`
}
