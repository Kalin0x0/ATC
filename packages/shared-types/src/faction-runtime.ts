export type AtcFactionType = 'gang' | 'police' | 'military' | 'government' | 'civilian' | 'other'

export type AtcFactionStatus = 'active' | 'disbanded' | 'suspended'

export type AtcTerritoryType =
  | 'district'
  | 'zone'
  | 'building'
  | 'intersection'
  | 'highway'
  | 'port'
  | 'airport'
  | 'other'

export type AtcClaimType = 'capture' | 'purchase' | 'grant' | 'inheritance'

export type AtcClaimStatus = 'active' | 'superseded' | 'released'

export type AtcConflictType =
  | 'territory_capture'
  | 'resource_dispute'
  | 'retaliation'
  | 'war'
  | 'skirmish'

export type AtcConflictStatus = 'active' | 'resolved' | 'aborted' | 'stalemate'

export type AtcConflictOutcome = 'attacker_won' | 'defender_won' | 'stalemate' | 'aborted'

export type AtcResourceNodeType =
  | 'mine'
  | 'oil_field'
  | 'farm'
  | 'dock'
  | 'warehouse'
  | 'lab'
  | 'safehouse'
  | 'other'

export interface AtcFaction {
  id: string
  name: string
  tag: string
  leaderPrincipalId: string
  factionType: AtcFactionType
  status: AtcFactionStatus
  memberCount: number
  colorHex: string | null
  description: string | null
  territoryCount: number
  createdAt: Date
  updatedAt: Date
}

export interface AtcTerritory {
  id: string
  territoryId: string
  label: string
  territoryType: AtcTerritoryType
  controllingFactionId: string | null
  influenceLevel: number
  isContested: boolean
  centerX: number | null
  centerY: number | null
  centerZ: number | null
  radius: number | null
  taxRate: number
  lastCaptureAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcTerritoryClaim {
  id: string
  territoryId: string
  factionId: string
  claimedByPrincipalId: string
  claimType: AtcClaimType
  status: AtcClaimStatus
  claimNonce: string
  claimedAt: Date
  releasedAt: Date | null
  supersededAt: Date | null
  notes: string | null
}

export interface AtcFactionConflict {
  id: string
  territoryId: string
  attackerFactionId: string
  defenderFactionId: string | null
  initiatingPrincipalId: string
  conflictType: AtcConflictType
  status: AtcConflictStatus
  outcome: AtcConflictOutcome | null
  conflictNonce: string
  participants: string[]
  startedAt: Date
  endedAt: Date | null
  notes: string | null
}

export interface AtcResourceNode {
  id: string
  nodeId: string
  label: string
  nodeType: AtcResourceNodeType
  controllingFactionId: string | null
  yieldRate: number
  isActive: boolean
  centerX: number | null
  centerY: number | null
  centerZ: number | null
  lastCapturedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcInfluenceRecord {
  id: string
  factionId: string
  territoryId: string
  influenceScore: number
  influenceDelta: number
  lastTickAt: Date
  decayRate: number
  createdAt: Date
  updatedAt: Date
}

export const ATC_FACTION_EVENTS = {
  FACTION_CREATED:          'atc:faction:created',
  FACTION_DISBANDED:        'atc:faction:disbanded',
  MEMBER_JOINED:            'atc:faction:member:joined',
  MEMBER_LEFT:              'atc:faction:member:left',
  TERRITORY_CLAIMED:        'atc:faction:territory:claimed',
  TERRITORY_RELEASED:       'atc:faction:territory:released',
  CONFLICT_STARTED:         'atc:faction:conflict:started',
  CONFLICT_RESOLVED:        'atc:faction:conflict:resolved',
  RESOURCE_CAPTURED:        'atc:faction:resource:captured',
  RESOURCE_RELEASED:        'atc:faction:resource:released',
} as const

export type AtcFactionEventName = typeof ATC_FACTION_EVENTS[keyof typeof ATC_FACTION_EVENTS]
