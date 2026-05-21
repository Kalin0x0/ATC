// Pool
export type { PoolConnection, ContinuityRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  ContinuityRuntimeError,
  ContinuityNotFoundError,
  DuplicateContinuityError,
  TemporalRecoveryNotFoundError,
  CheckpointNotFoundError,
  DuplicateCheckpointError,
  PersistenceNodeNotFoundError,
  TemporalIntegrityNotFoundError,
} from './errors.js'

// Continuity Runtime Repository
export type {
  AtcContinuityType,
  AtcContinuityStatus,
  AtcRuntimeContinuity,
  CreateContinuityParams,
} from './continuity-runtime.repository.js'
export { ContinuityRuntimeRepository } from './continuity-runtime.repository.js'

// Temporal Recovery Repository
export type {
  AtcTemporalRecoveryType,
  AtcTemporalRecoveryStatus,
  AtcTemporalRecovery,
  CreateTemporalRecoveryParams,
} from './temporal-recovery.repository.js'
export { TemporalRecoveryRepository } from './temporal-recovery.repository.js'

// Checkpoint Runtime Repository
export type {
  AtcCheckpointType,
  AtcCheckpointStatus,
  AtcCheckpointRuntime,
  CreateCheckpointParams,
} from './checkpoint-runtime.repository.js'
export { CheckpointRuntimeRepository } from './checkpoint-runtime.repository.js'

// Infinite Persistence Repository
export type {
  AtcPersistenceNodeType,
  AtcPersistenceNodeStatus,
  AtcInfinitePersistence,
  UpsertPersistenceNodeParams,
} from './infinite-persistence.repository.js'
export { InfinitePersistenceRepository } from './infinite-persistence.repository.js'

// Temporal Integrity Repository
export type {
  AtcTemporalIntegrityType,
  AtcTemporalIntegrityStatus,
  AtcTemporalIntegrity,
  CreateTemporalIntegrityParams,
} from './temporal-integrity.repository.js'
export { TemporalIntegrityRepository } from './temporal-integrity.repository.js'

// Continuity Audit Repository
export type { AtcContinuityAuditEntry } from './continuity-audit.repository.js'
export { ContinuityAuditRepository } from './continuity-audit.repository.js'

// Services
export type { ContinuityRuntimeEventBus, ContinuityCleanupResult } from './temporal-integrity-recovery.service.js'
export { TemporalIntegrityRecoveryService } from './temporal-integrity-recovery.service.js'

export type { CreateContinuityServiceParams } from './continuity-runtime.service.js'
export { ContinuityRuntimeService } from './continuity-runtime.service.js'

export type { InitiateRecoveryServiceParams } from './temporal-recovery.service.js'
export { TemporalRecoveryService } from './temporal-recovery.service.js'

export type { UpsertPersistenceNodeServiceParams } from './infinite-persistence.service.js'
export { InfinitePersistenceService } from './infinite-persistence.service.js'

export type { CreateCheckpointServiceParams } from './checkpoint-coordinator.service.js'
export { RuntimeCheckpointCoordinator } from './checkpoint-coordinator.service.js'

export type { UpsertContinuityNodeServiceParams } from './distributed-continuity.service.js'
export { DistributedContinuityService } from './distributed-continuity.service.js'
