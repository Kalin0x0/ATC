// Pool
export type { PoolConnection, CoreFinalizationPool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  CoreFinalizationError,
  FinalizationNotFoundError,
  DuplicateFinalizationError,
  CompletionNotFoundError,
  DuplicateCompletionError,
  ProductionSealNotFoundError,
  DuplicateProductionSealError,
  DeterministicSealingNotFoundError,
  DuplicateDeterministicSealingError,
} from './errors.js'

// Core Finalization Repository
export type {
  AtcCoreFinalizationType,
  AtcCoreFinalizationStatus,
  AtcCoreFinalization,
  CreateCoreFinalizationParams,
} from './core-finalization.repository.js'
export { CoreFinalizationRepository } from './core-finalization.repository.js'

// Runtime Completion Repository
export type {
  AtcCompletionType,
  AtcCompletionStatus,
  AtcRuntimeCompletion,
  CreateCompletionParams,
} from './runtime-completion.repository.js'
export { RuntimeCompletionRepository } from './runtime-completion.repository.js'

// Production Seal Repository
export type {
  AtcProductionSealType,
  AtcProductionSealStatus,
  AtcProductionSeal,
  CreateProductionSealParams,
} from './production-seal.repository.js'
export { ProductionSealRepository } from './production-seal.repository.js'

// Finalization Coordination Repository
export type {
  AtcFinalizationCoordinationType,
  AtcFinalizationCoordinationStatus,
  AtcFinalizationCoordination,
  UpsertFinalizationCoordinationParams,
} from './finalization-coordination.repository.js'
export { FinalizationCoordinationRepository } from './finalization-coordination.repository.js'

// Deterministic Sealing Repository
export type {
  AtcDeterministicSealingType,
  AtcDeterministicSealingStatus,
  AtcDeterministicSealing,
  CreateDeterministicSealingParams,
} from './deterministic-sealing.repository.js'
export { DeterministicSealingRepository } from './deterministic-sealing.repository.js'

// Core Finalization Audit Repository
export type {
  AtcCoreFinalizationAuditEntry,
  AppendCoreFinalizationAuditParams,
} from './core-finalization-audit.repository.js'
export { CoreFinalizationAuditRepository } from './core-finalization-audit.repository.js'

// Services
export type {
  CoreFinalizationEventBus,
  CoreFinalizationCleanupResult,
} from './finalization-recovery.service.js'
export { FinalizationRecoveryService } from './finalization-recovery.service.js'

export type { CreateCoreFinalizationServiceParams } from './core-finalization.service.js'
export { CoreFinalizationService } from './core-finalization.service.js'

export { DeterministicSealService } from './deterministic-seal.service.js'

export { ProductionCompletionService } from './production-completion.service.js'

export { RuntimeCompletionCoordinator } from './runtime-completion-coordinator.service.js'

export { DistributedFinalSealService } from './distributed-final-seal.service.js'
