// Pool
export type { PoolConnection, RuntimeResiliencePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  RuntimeResilienceError,
  FailoverNotFoundError,
  DuplicateFailoverError,
  RecoverySnapshotNotFoundError,
  ChaosRuntimeNotFoundError,
  ResilienceRecordNotFoundError,
  RecoveryOperationNotFoundError,
  FailoverAlreadyActiveError,
  DuplicateChaosTestError,
  DuplicateRecoveryOperationError,
} from './errors.js'

// Runtime Failover Repository
export type {
  AtcFailoverType,
  AtcFailoverStatus,
  AtcRuntimeFailover,
  CreateFailoverParams,
} from './runtime-failover.repository.js'
export { RuntimeFailoverRepository } from './runtime-failover.repository.js'

// Recovery Snapshot Repository
export type {
  AtcRecoverySnapshotType,
  AtcRecoverySnapshot,
  CreateRecoverySnapshotParams,
} from './recovery-snapshot.repository.js'
export { RecoverySnapshotRepository } from './recovery-snapshot.repository.js'

// Chaos Runtime Repository
export type {
  AtcChaosTestType,
  AtcChaosTestStatus,
  AtcChaosRuntime,
  CreateChaosTestParams,
} from './chaos-runtime.repository.js'
export { ChaosRuntimeRepository } from './chaos-runtime.repository.js'

// Runtime Resilience Repository
export type {
  AtcResilienceType,
  AtcResilienceStatus,
  AtcResilienceRecord,
  UpsertResilienceParams,
} from './runtime-resilience.repository.js'
export { RuntimeResilienceRepository } from './runtime-resilience.repository.js'

// Failover Audit Repository
export type { AtcFailoverAuditEntry } from './failover-audit.repository.js'
export { FailoverAuditRepository } from './failover-audit.repository.js'

// Recovery Operation Repository
export type {
  AtcRecoveryOperationType,
  AtcRecoveryOperationStatus,
  AtcRecoveryOperation,
  CreateRecoveryOperationParams,
} from './recovery-operation.repository.js'
export { RecoveryOperationRepository } from './recovery-operation.repository.js'

// Services
export type { RuntimeResilienceEventBus } from './runtime-recovery-coordinator.js'
export { RuntimeRecoveryCoordinator } from './runtime-recovery-coordinator.js'
export { FailoverOrchestrationService } from './failover-orchestration.service.js'
export { ChaosSimulationService } from './chaos-simulation.service.js'
export { RuntimeResilienceService } from './runtime-resilience.service.js'
export { SnapshotRecoveryService } from './snapshot-recovery.service.js'
export { DistributedHealthRecoveryService } from './distributed-health-recovery.service.js'
