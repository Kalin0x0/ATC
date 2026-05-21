// Pool
export type { PoolConnection, MetaRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  MetaRuntimeError,
  MetaNotFoundError,
  DuplicateMetaError,
  HealingNotFoundError,
  DuplicateHealingError,
  RepairNotFoundError,
  DuplicateRepairError,
} from './errors.js'

// Meta Runtime Repository
export type {
  AtcMetaType,
  AtcMetaStatus,
  AtcMetaRuntime,
  CreateMetaRuntimeParams,
} from './meta-runtime.repository.js'
export { MetaRuntimeRepository } from './meta-runtime.repository.js'

// Healing Operation Repository
export type {
  AtcHealingType,
  AtcHealingStatus,
  AtcHealingOperation,
  CreateHealingOperationParams,
} from './healing-operation.repository.js'
export { HealingOperationRepository } from './healing-operation.repository.js'

// Distributed Repair Repository
export type {
  AtcRepairType,
  AtcRepairStatus,
  AtcDistributedRepair,
  CreateDistributedRepairParams,
} from './distributed-repair.repository.js'
export { DistributedRepairRepository } from './distributed-repair.repository.js'

// Meta Allocation Repository
export type {
  AtcAllocationType,
  AtcAllocationStatus,
  AtcMetaAllocation,
  UpsertMetaAllocationParams,
} from './meta-allocation.repository.js'
export { MetaAllocationRepository } from './meta-allocation.repository.js'

// Runtime Coordination Repository
export type {
  AtcCoordinationType,
  AtcCoordinationStatus,
  AtcRuntimeCoordination,
  UpsertRuntimeCoordinationParams,
} from './runtime-coordination.repository.js'
export { RuntimeCoordinationRepository } from './runtime-coordination.repository.js'

// Meta Audit Repository
export type { AppendMetaAuditParams } from './meta-audit.repository.js'
export { MetaAuditRepository } from './meta-audit.repository.js'

// EventBus interface (defined in recovery service)
export type { MetaRuntimeEventBus } from './self-healing-recovery.service.js'

// Services
export { SelfHealingRecoveryService } from './self-healing-recovery.service.js'

export type { RegisterMetaParams } from './meta-runtime.service.js'
export { MetaRuntimeService } from './meta-runtime.service.js'

export type { StartHealingParams } from './autonomous-healing.service.js'
export { AutonomousHealingService } from './autonomous-healing.service.js'

export type { StartRepairParams } from './distributed-repair.service.js'
export { DistributedRepairService } from './distributed-repair.service.js'

export type { AllocateParams } from './meta-allocation.service.js'
export { MetaAllocationService } from './meta-allocation.service.js'

export type { UpsertCoordinationParams } from './runtime-coordination.service.js'
export { RuntimeCoordinationService } from './runtime-coordination.service.js'
