export type AtcGangStatus = 'active' | 'disbanded' | 'suspended'
export type AtcGangMemberRank = 'leader' | 'officer' | 'member' | 'associate'
export type AtcOperationStatus = 'planning' | 'active' | 'completed' | 'failed' | 'aborted'
export type AtcOperationType = 'heist' | 'drug_run' | 'smuggling' | 'extortion' | 'assassination' | 'theft' | 'other'
export type AtcRaidStatus = 'staging' | 'active' | 'completed' | 'aborted'
export type AtcRaidOutcome = 'success' | 'failure' | 'partial' | 'aborted'
export type AtcContrabandStatus = 'registered' | 'seized' | 'destroyed'

export interface AtcGang {
  id: string
  name: string
  tag: string
  leaderPrincipalId: string
  territoryId: string | null
  status: AtcGangStatus
  memberCount: number
  createdAt: Date
  updatedAt: Date
}

export interface AtcGangMember {
  id: string
  gangId: string
  principalId: string
  rank: AtcGangMemberRank
  invitedByPrincipalId: string | null
  joinedAt: Date
  leftAt: Date | null
}

export interface AtcCriminalOperation {
  id: string
  label: string
  operationType: AtcOperationType
  ownerPrincipalId: string
  gangId: string | null
  status: AtcOperationStatus
  startedAt: Date | null
  endedAt: Date | null
  outcome: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcContraband {
  id: string
  propertyId: string | null
  stashId: string | null
  itemName: string
  quantity: number
  status: AtcContrabandStatus
  registeredByPrincipalId: string
  seizedByPrincipalId: string | null
  seizedAt: Date | null
  registeredAt: Date
}

export interface AtcBlackMarketTransaction {
  id: string
  sellerPrincipalId: string
  buyerPrincipalId: string
  itemName: string
  quantity: number
  price: number
  locationLabel: string | null
  completedAt: Date | null
  createdAt: Date
}

export interface AtcRaid {
  id: string
  propertyId: string
  initiatingAgencyId: string | null
  leadPrincipalId: string
  status: AtcRaidStatus
  outcome: AtcRaidOutcome | null
  participants: string[]
  startedAt: Date | null
  endedAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export const ATC_CRIMINAL_EVENTS = {
  GANG_CREATED:              'atc:criminal:gang:created',
  GANG_DISBANDED:            'atc:criminal:gang:disbanded',
  GANG_MEMBER_JOINED:        'atc:criminal:gang:member:joined',
  GANG_MEMBER_LEFT:          'atc:criminal:gang:member:left',
  OPERATION_STARTED:         'atc:criminal:operation:started',
  OPERATION_COMPLETED:       'atc:criminal:operation:completed',
  OPERATION_ABORTED:         'atc:criminal:operation:aborted',
  CONTRABAND_REGISTERED:     'atc:criminal:contraband:registered',
  CONTRABAND_SEIZED:         'atc:criminal:contraband:seized',
  RAID_STARTED:              'atc:criminal:raid:started',
  RAID_COMPLETED:            'atc:criminal:raid:completed',
  BLACK_MARKET_TRADE:        'atc:criminal:black_market:trade',
} as const

export type AtcCriminalEventName = typeof ATC_CRIMINAL_EVENTS[keyof typeof ATC_CRIMINAL_EVENTS]
