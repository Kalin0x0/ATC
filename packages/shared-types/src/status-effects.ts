export type AtcStatusEffectType =
  | 'fatigue'
  | 'dehydrated'
  | 'starving'
  | 'stressed'
  | 'injured'
  | 'custom'

export type AtcStatusEffectSeverity = 'low' | 'medium' | 'high' | 'critical'

export type AtcStatusEffectSource = 'vitals' | 'item' | 'system' | 'admin'

export interface AtcStatusEffect {
  id: string
  characterId: string
  type: AtcStatusEffectType
  severity: AtcStatusEffectSeverity
  source: AtcStatusEffectSource
  reason: string
  startedAt: string
  expiresAt: string | null
  metadata?: Record<string, unknown>
}

export interface AtcApplyStatusEffectRequest {
  type: AtcStatusEffectType
  severity: AtcStatusEffectSeverity
  source: AtcStatusEffectSource
  reason: string
  durationSeconds?: number
  metadata?: Record<string, unknown>
}

export interface AtcStatusEffectsResponse {
  characterId: string
  effects: AtcStatusEffect[]
}

export interface AtcStatusEffectChangedEvent {
  characterId: string
  type?: AtcStatusEffectType
  action: 'applied' | 'cleared' | 'cleared_all'
  effect?: AtcStatusEffect
  timestamp: string
}
