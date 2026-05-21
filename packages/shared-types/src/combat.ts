export type AtcWeaponCategory = 'pistol' | 'rifle' | 'shotgun' | 'smg' | 'sniper' | 'melee' | 'explosive' | 'thrown' | 'unarmed'
export type AtcWeaponStatus = 'registered' | 'active' | 'lost' | 'seized' | 'destroyed'
export type AtcCombatSessionStatus = 'active' | 'ended' | 'abandoned'
export type AtcCombatBodyRegion = 'head' | 'chest' | 'abdomen' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg' | 'back' | 'unknown'
export type AtcInjurySeverity = 'minor' | 'moderate' | 'severe' | 'critical' | 'fatal'

export interface AtcWeaponRegistration {
  id: string
  ownerId: string | null
  organizationId: string | null
  model: string
  category: AtcWeaponCategory
  serial: string
  durability: number
  isLocked: boolean
  status: AtcWeaponStatus
  registeredByPrincipalId: string | null
  seizedByPrincipalId: string | null
  seizedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcWeaponRuntime {
  id: string
  weaponId: string
  holderPrincipalId: string
  isEquipped: boolean
  currentAmmo: number
  maxAmmo: number
  attachmentState: Record<string, string> | null
  equippedAt: Date | null
  unequippedAt: Date | null
  lastSyncAt: Date
}

export interface AtcDamageEvent {
  id: string
  sessionId: string | null
  attackerPrincipalId: string
  victimPrincipalId: string
  weaponId: string | null
  weaponModel: string
  hitBone: AtcCombatBodyRegion
  damageAmount: number
  mitigatedAmount: number
  netDamage: number
  hitX: number | null
  hitY: number | null
  hitZ: number | null
  replayNonce: string
  createdAt: Date
}

export interface AtcCombatSession {
  id: string
  initiatorPrincipalId: string
  status: AtcCombatSessionStatus
  outcome: string | null
  startedAt: Date
  endedAt: Date | null
  participantCount: number
  createdAt: Date
}

export interface AtcBallisticsRecord {
  id: string
  damageEventId: string
  velocity: number | null
  distance: number | null
  impactAngle: number | null
  penetrationData: string | null
  createdAt: Date
}

export interface AtcCombatInjury {
  id: string
  principalId: string
  bodyRegion: AtcCombatBodyRegion
  severity: AtcInjurySeverity
  sourceDamageEventId: string | null
  appliedAt: Date
  resolvedAt: Date | null
}

export const ATC_COMBAT_EVENTS = {
  COMBAT_STARTED:      'atc:combat:session:started',
  COMBAT_ENDED:        'atc:combat:session:ended',
  DAMAGE_APPLIED:      'atc:combat:damage:applied',
  WEAPON_EQUIPPED:     'atc:combat:weapon:equipped',
  WEAPON_UNEQUIPPED:   'atc:combat:weapon:unequipped',
  INJURY_APPLIED:      'atc:combat:injury:applied',
  INJURY_RESOLVED:     'atc:combat:injury:resolved',
  WEAPON_REGISTERED:   'atc:combat:weapon:registered',
  WEAPON_SEIZED:       'atc:combat:weapon:seized',
} as const

export type AtcCombatEventName = typeof ATC_COMBAT_EVENTS[keyof typeof ATC_COMBAT_EVENTS]
