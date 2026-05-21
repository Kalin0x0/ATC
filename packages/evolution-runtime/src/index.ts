// Pool
export type { PoolConnection, EvolutionRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  EvolutionRuntimeError,
  EvolutionRuntimeNotFoundError,
  DuplicateEvolutionRuntimeError,
  OptimizationNotFoundError,
  DuplicateOptimizationError,
  AutonomousEvolutionNotFoundError,
  DuplicateAutonomousEvolutionError,
} from './errors.js'

// Runtime Evolution Repository
export type {
  AtcEvolutionRuntimeType,
  AtcEvolutionRuntimeStatus,
  AtcRuntimeEvolution,
  CreateRuntimeEvolutionParams,
} from './runtime-evolution.repository.js'
export { RuntimeEvolutionRepository } from './runtime-evolution.repository.js'

// Adaptive Optimization Repository
export type {
  AtcOptimizationType,
  AtcOptimizationStatus,
  AtcAdaptiveOptimization,
  CreateAdaptiveOptimizationParams,
} from './adaptive-optimization.repository.js'
export { AdaptiveOptimizationRepository } from './adaptive-optimization.repository.js'

// Runtime Tuning Repository
export type {
  AtcTuningType,
  AtcTuningStatus,
  AtcRuntimeTuning,
  UpsertRuntimeTuningParams,
} from './runtime-tuning.repository.js'
export { RuntimeTuningRepository } from './runtime-tuning.repository.js'

// Autonomous Evolution Repository
export type {
  AtcAutonomousEvolutionType,
  AtcAutonomousEvolutionStatus,
  AtcAutonomousEvolution,
  CreateAutonomousEvolutionParams,
} from './autonomous-evolution.repository.js'
export { AutonomousEvolutionRepository } from './autonomous-evolution.repository.js'

// Distributed Optimization Repository
export type {
  AtcDistributedOptType,
  AtcDistributedOptStatus,
  AtcDistributedOptimization,
  UpsertDistributedOptimizationParams,
} from './distributed-optimization.repository.js'
export { DistributedOptimizationRepository } from './distributed-optimization.repository.js'

// Evolution Audit Repository
export type { AppendEvolutionAuditParams } from './evolution-audit.repository.js'
export { EvolutionAuditRepository } from './evolution-audit.repository.js'

// EventBus interface and recovery (defined in recovery service)
export type {
  EvolutionRuntimeEventBus,
  EvolutionCleanupResult,
} from './evolution-recovery.service.js'
export { EvolutionRecoveryService } from './evolution-recovery.service.js'

// Services
export type { StartEvolutionRuntimeServiceParams } from './runtime-evolution.service.js'
export { EvolutionRuntimeService } from './runtime-evolution.service.js'

export type { StartOptimizationServiceParams } from './adaptive-optimization.service.js'
export { AdaptiveOptimizationService } from './adaptive-optimization.service.js'

export type { UpsertTuningServiceParams } from './runtime-tuning.service.js'
export { RuntimeTuningService } from './runtime-tuning.service.js'

export type { TriggerAutonomousEvolutionServiceParams } from './autonomous-evolution.service.js'
export { AutonomousEvolutionService } from './autonomous-evolution.service.js'

export type { UpsertDistributedOptServiceParams } from './distributed-optimization.service.js'
export { DistributedOptimizationService } from './distributed-optimization.service.js'
