// Pool
export type { PoolConnection, WorldOrchestratorPool } from './pool.js'

// ID generation
export { generateId } from './id.js'

// Errors
export {
  WorldOrchestratorError,
  WorldRegionNotFoundError,
  DuplicateWorldRegionError,
  RuntimeAllocationNotFoundError,
  ShardRuntimeNotFoundError,
  DuplicateShardError,
  RegionalSimulationNotFoundError,
  StaleShardError,
} from './errors.js'

// World Region Repository
export type {
  AtcWorldRegionType,
  AtcWorldRegion,
  UpsertWorldRegionParams,
} from './world-region.repository.js'
export { WorldRegionRepository } from './world-region.repository.js'

// Runtime Allocation Repository
export type {
  AtcAllocationType,
  AtcAllocationStatus,
  AtcRuntimeAllocation,
  CreateAllocationParams,
} from './runtime-allocation.repository.js'
export { RuntimeAllocationRepository } from './runtime-allocation.repository.js'

// Shard Runtime Repository
export type {
  AtcShardType,
  AtcShardRuntime,
  UpsertShardParams,
} from './shard-runtime.repository.js'
export { ShardRuntimeRepository } from './shard-runtime.repository.js'

// Regional Simulation Repository
export type {
  AtcSimulationType,
  AtcRegionalSimulation,
  UpsertSimulationParams,
} from './regional-simulation.repository.js'
export { RegionalSimulationRepository } from './regional-simulation.repository.js'

// World Balancing Repository
export type {
  AtcBalancingTrigger,
  AtcWorldBalancing,
  RecordBalancingParams,
} from './world-balancing.repository.js'
export { WorldBalancingRepository } from './world-balancing.repository.js'

// Audit Repository
export { WorldOrchestrationAuditRepository } from './world-orchestration-audit.repository.js'

// Services
export type { WorldOrchestratorEventBus } from './world-orchestrator.service.js'
export { WorldOrchestratorService } from './world-orchestrator.service.js'
export { DistributedShardService } from './distributed-shard.service.js'
export { RegionalSimulationService } from './regional-simulation.service.js'
export { RuntimeBalancingService } from './runtime-balancing.service.js'
export { RuntimeAllocationService } from './runtime-allocation.service.js'
export { PersistentWorldRecoveryService } from './persistent-world-recovery.service.js'
