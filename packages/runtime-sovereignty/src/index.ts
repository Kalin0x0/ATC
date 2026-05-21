// Pool
export type { PoolConnection, SovereigntyRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  SovereigntyRuntimeError,
  SovereigntyNotFoundError,
  DuplicateSovereigntyError,
  ClusterContinuityNotFoundError,
  AutonomousFinalizationNotFoundError,
  DuplicateAutonomousFinalizationError,
  SuccessionNotFoundError,
  DuplicateSuccessionError,
} from './errors.js'

// Runtime Sovereignty Repository
export type {
  AtcSovereigntyType,
  AtcSovereigntyStatus,
  AtcRuntimeSovereignty,
  CreateSovereigntyParams,
} from './runtime-sovereignty.repository.js'
export { RuntimeSovereigntyRepository } from './runtime-sovereignty.repository.js'

// Cluster Continuity Repository
export type {
  AtcClusterType,
  AtcClusterStatus,
  AtcClusterContinuity,
  UpsertClusterParams,
} from './cluster-continuity.repository.js'
export { ClusterContinuityRepository } from './cluster-continuity.repository.js'

// Autonomous Finalization Repository
export type {
  AtcAutonomousFinalizationType,
  AtcAutonomousFinalizationStatus,
  AtcAutonomousFinalization,
  CreateAutonomousFinalizationParams,
} from './autonomous-finalization.repository.js'
export { AutonomousFinalizationRepository } from './autonomous-finalization.repository.js'

// Runtime Succession Repository
export type {
  AtcSuccessionType,
  AtcSuccessionStatus,
  AtcRuntimeSuccession,
  CreateSuccessionParams,
} from './runtime-succession.repository.js'
export { RuntimeSuccessionRepository } from './runtime-succession.repository.js'

// Sovereignty Coordination Repository
export type {
  AtcSovereigntyCoordinationType,
  AtcSovereigntyCoordinationStatus,
  AtcSovereigntyCoordination,
  UpsertSovereigntyCoordinationParams,
} from './sovereignty-coordination.repository.js'
export { SovereigntyCoordinationRepository } from './sovereignty-coordination.repository.js'

// Sovereignty Audit Repository
export type {
  AtcSovereigntyAuditEntry,
  AppendSovereigntyAuditParams,
} from './sovereignty-audit.repository.js'
export { SovereigntyAuditRepository } from './sovereignty-audit.repository.js'

// Services
export type {
  SovereigntyRuntimeEventBus,
  SovereigntyCleanupResult,
} from './sovereignty-recovery.service.js'
export { SovereigntyRecoveryService } from './sovereignty-recovery.service.js'

export type { EstablishSovereigntyParams } from './runtime-sovereignty.service.js'
export { RuntimeSovereigntyService } from './runtime-sovereignty.service.js'

export { InfiniteClusterContinuityService } from './cluster-continuity.service.js'

export { AutonomousFinalizationService } from './autonomous-finalization.service.js'

export { RuntimeSuccessionService } from './runtime-succession.service.js'

export { DistributedSovereigntyCoordinator } from './distributed-sovereignty.service.js'
