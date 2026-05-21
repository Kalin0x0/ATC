export type AtcWorldEntityStatus = 'registered' | 'active' | 'despawned' | 'cleanup_pending' | 'cleaned'
export type AtcWorldEntityType = 'vehicle' | 'object' | 'ped' | 'pickup' | 'blip' | 'zone' | 'other'
export type AtcSceneStatus = 'active' | 'suspended' | 'destroyed' | 'cleanup_pending'
export type AtcPersistentSceneType = 'crime_scene' | 'accident' | 'blockade' | 'event' | 'construction' | 'other'
export type AtcCleanupReason = 'timeout' | 'manual' | 'server_restart' | 'owner_disconnect' | 'scene_destroyed'

export interface AtcWorldEntity {
  id: string
  entityType: AtcWorldEntityType
  ownerPrincipalId: string | null
  networkId: number | null
  model: string
  x: number
  y: number
  z: number
  heading: number
  spawnNonce: string
  status: AtcWorldEntityStatus
  sceneId: string | null
  spawnedAt: Date
  despawnedAt: Date | null
  createdAt: Date
}

export interface AtcSceneRuntime {
  id: string
  sceneId: string
  creatorPrincipalId: string
  label: string
  isLocked: boolean
  status: AtcSceneStatus
  replicationNode: string | null
  entityCount: number
  createdAt: Date
  updatedAt: Date
}

export interface AtcEntityOwnership {
  id: string
  entityId: string
  sceneId: string | null
  principalId: string
  acquiredAt: Date
  releasedAt: Date | null
}

export interface AtcPersistentScene {
  id: string
  sceneId: string
  sceneType: AtcPersistentSceneType
  worldRegion: string | null
  data: Record<string, unknown>
  persistedAt: Date
  expiresAt: Date | null
  restoredAt: Date | null
}

export interface AtcRuntimeCleanup {
  id: string
  targetType: string
  targetId: string
  cleanupReason: AtcCleanupReason
  scheduledAt: Date
  completedAt: Date | null
  nodeId: string | null
}

export const ATC_WORLD_EVENTS = {
  SCENE_CREATED:              'atc:world:scene:created',
  SCENE_DESTROYED:            'atc:world:scene:destroyed',
  SCENE_SUSPENDED:            'atc:world:scene:suspended',
  ENTITY_REGISTERED:          'atc:world:entity:registered',
  ENTITY_DESPAWNED:           'atc:world:entity:despawned',
  ENTITY_RECONCILED:          'atc:world:entity:reconciled',
  OWNERSHIP_ACQUIRED:         'atc:world:ownership:acquired',
  OWNERSHIP_RELEASED:         'atc:world:ownership:released',
  CLEANUP_SCHEDULED:          'atc:world:cleanup:scheduled',
  CLEANUP_COMPLETED:          'atc:world:cleanup:completed',
  PERSISTENT_SCENE_SAVED:     'atc:world:persistent_scene:saved',
  PERSISTENT_SCENE_RESTORED:  'atc:world:persistent_scene:restored',
} as const

export type AtcWorldEventName = typeof ATC_WORLD_EVENTS[keyof typeof ATC_WORLD_EVENTS]
