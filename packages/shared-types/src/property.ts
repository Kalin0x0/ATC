export type AtcPropertyStatus =
  | 'available'
  | 'owned'
  | 'occupied'
  | 'locked'
  | 'breached'
  | 'seized'
  | 'abandoned'

export type AtcPropertyAccessType =
  | 'owner'
  | 'co_owner'
  | 'tenant'
  | 'guest'
  | 'organization'
  | 'emergency_ems'
  | 'emergency_law'

export type AtcPropertyAlarmState = 'off' | 'armed' | 'triggered'

export type AtcPropertyStashType =
  | 'personal'
  | 'shared'
  | 'evidence'
  | 'medical'
  | 'organization'

export interface AtcProperty {
  id: string
  ownerId: string | null
  organizationId: string | null
  name: string
  address: string
  interiorType: string
  shellId: string | null
  status: AtcPropertyStatus
  isLocked: boolean
  alarmState: AtcPropertyAlarmState
  storageCapacity: number
  notes: string | null
  seizedByPrincipalId: string | null
  seizedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AtcPropertyAccess {
  id: string
  propertyId: string
  principalId: string
  accessType: AtcPropertyAccessType
  grantedByPrincipalId: string
  expiresAt: Date | null
  revokedAt: Date | null
  revokedByPrincipalId: string | null
  grantedAt: Date
}

export interface AtcPropertyKey {
  id: string
  propertyId: string
  issuedToPrincipalId: string
  issuedByPrincipalId: string
  issuedAt: Date
  revokedAt: Date | null
  revokedByPrincipalId: string | null
}

export interface AtcPropertyStash {
  id: string
  propertyId: string
  stashId: string
  label: string
  stashType: AtcPropertyStashType
  ownerId: string | null
  organizationId: string | null
  capacity: number
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AtcPropertyStashItem {
  id: string
  stashRecordId: string
  itemName: string
  quantity: number
  metadata: unknown
  addedByPrincipalId: string
  addedAt: Date
}

export interface AtcPropertyGarage {
  id: string
  propertyId: string
  garageId: string
  label: string
  capacity: number
  linkedByPrincipalId: string
  linkedAt: Date
  unlinkedAt: Date | null
  unlinkedByPrincipalId: string | null
}

export interface AtcPropertyRuntime {
  id: string
  propertyId: string
  isOnline: boolean
  occupantCount: number
  breachStartedAt: Date | null
  breachByPrincipalId: string | null
  breachReason: string | null
  lastActivityAt: Date
  createdAt: Date
}

export interface AtcPropertyOccupant {
  id: string
  propertyId: string
  principalId: string
  enteredAt: Date
  exitedAt: Date | null
}

export const ATC_PROPERTY_EVENTS = {
  PROPERTY_PURCHASED:      'atc:property:purchased',
  PROPERTY_SOLD:           'atc:property:sold',
  PROPERTY_LOCKED:         'atc:property:locked',
  PROPERTY_UNLOCKED:       'atc:property:unlocked',
  PROPERTY_BREACHED:       'atc:property:breached',
  PROPERTY_BREACH_ENDED:   'atc:property:breach_ended',
  PROPERTY_SEIZED:         'atc:property:seized',
  PROPERTY_SEIZURE_RELEASED: 'atc:property:seizure_released',
  PROPERTY_ENTERED:        'atc:property:entered',
  PROPERTY_EXITED:         'atc:property:exited',
  ACCESS_GRANTED:          'atc:property:access:granted',
  ACCESS_REVOKED:          'atc:property:access:revoked',
  KEY_ISSUED:              'atc:property:key:issued',
  KEY_REVOKED:             'atc:property:key:revoked',
  STASH_OPENED:            'atc:property:stash:opened',
  STASH_DEPOSIT:           'atc:property:stash:deposit',
  STASH_WITHDRAW:          'atc:property:stash:withdraw',
  GARAGE_LINKED:           'atc:property:garage:linked',
  GARAGE_UNLINKED:         'atc:property:garage:unlinked',
} as const
