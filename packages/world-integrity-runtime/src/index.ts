// Pool
export type { PoolConnection, WorldIntegrityPool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  WorldIntegrityRuntimeError,
  IntegrityNotFoundError,
  DuplicateIntegrityError,
  LockNotFoundError,
  ConsistencyNotFoundError,
  ValidationNotFoundError,
  DuplicateValidationError,
  ReconciliationNotFoundError,
  DuplicateReconciliationError,
} from './errors.js'

// World Integrity Repository
export type {
  AtcIntegrityType,
  AtcIntegrityStatus,
  AtcWorldIntegrity,
  CreateIntegrityParams,
} from './world-integrity.repository.js'
export { WorldIntegrityRepository } from './world-integrity.repository.js'

// Distributed Lock Repository
export type {
  AtcLockType,
  AtcLockStatus,
  AtcDistributedLock,
  UpsertLockParams,
} from './distributed-lock.repository.js'
export { DistributedLockRepository } from './distributed-lock.repository.js'

// Runtime Consistency Repository
export type {
  AtcConsistencyType,
  AtcConsistencyStatus,
  AtcRuntimeConsistency,
  UpsertConsistencyParams,
} from './runtime-consistency.repository.js'
export { RuntimeConsistencyRepository } from './runtime-consistency.repository.js'

// Integrity Validation Repository
export type {
  AtcValidationType,
  AtcValidationStatus,
  AtcIntegrityValidation,
  CreateValidationParams,
} from './integrity-validation.repository.js'
export { IntegrityValidationRepository } from './integrity-validation.repository.js'

// World Reconciliation Repository
export type {
  AtcReconciliationType,
  AtcReconciliationStatus,
  AtcWorldReconciliation,
  CreateReconciliationParams,
} from './world-reconciliation.repository.js'
export { WorldReconciliationRepository } from './world-reconciliation.repository.js'

// Integrity Audit Repository
export type { AtcIntegrityAuditEntry } from './integrity-audit.repository.js'
export { IntegrityAuditRepository } from './integrity-audit.repository.js'

// Services
export type { WorldIntegrityEventBus, IntegrityCleanupResult } from './integrity-recovery.service.js'
export { IntegrityRecoveryService } from './integrity-recovery.service.js'

export type { CreateIntegrityServiceParams } from './world-integrity.service.js'
export { WorldIntegrityService } from './world-integrity.service.js'

export type { AcquireLockServiceParams } from './distributed-locking.service.js'
export { DistributedLockingService } from './distributed-locking.service.js'

export type { UpsertConsistencyServiceParams } from './deterministic-consistency.service.js'
export { DeterministicConsistencyService } from './deterministic-consistency.service.js'

export type { StartValidationServiceParams } from './integrity-validation.service.js'
export { GlobalWorldValidationService } from './integrity-validation.service.js'

export type { StartReconciliationServiceParams } from './world-reconciliation.service.js'
export { RuntimeIntegrityCoordinator } from './world-reconciliation.service.js'
