export type AtcVitalName = 'health' | 'hunger' | 'thirst' | 'stamina' | 'stress' | 'armor'

export type AtcVitalsMutationMode = 'set' | 'increment' | 'decrement'

export type AtcVitalsEventSource = 'api' | 'lua' | 'decay' | 'item_effect' | 'system'

export interface AtcCharacterVitals {
  characterId: string
  health: number
  hunger: number
  thirst: number
  stamina: number
  stress: number
  armor: number
  createdAt: Date
  updatedAt: Date
}

export type AtcVitalsPatch = Partial<Record<AtcVitalName, number>>

export type AtcVitalsUpdateRequest = AtcVitalsPatch

export interface AtcVitalsMutationRequest {
  vital: AtcVitalName
  mode: AtcVitalsMutationMode
  amount: number
  metadata?: Record<string, unknown>
}

export type AtcVitalsResponse = AtcCharacterVitals

export interface AtcVitalsChangedEvent {
  characterId: string
  source: AtcVitalsEventSource
  timestamp: string
  changed?: Partial<Record<AtcVitalName, number>>
  vitals: AtcCharacterVitals
  metadata?: Record<string, unknown>
}

export interface AtcVitalsDecayConfig {
  enabled: boolean
  intervalSeconds: number
  hunger: number
  thirst: number
  stamina: number
  stress: number
}
