// Pool
export type { PoolConnection, ReplicationRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  ReplicationRuntimeError,
  SpatialOwnershipNotFoundError,
  DuplicateSpatialOwnershipError,
  SpatialNodeNotFoundError,
  SnapshotNotFoundError,
  InterestRegionNotFoundError,
  StreamingRuntimeNotFoundError,
  StaleOwnershipError,
} from './errors.js'

// Spatial Node Repository
export type {
  AtcSpatialNodeType,
  AtcSpatialNode,
  UpsertSpatialNodeParams,
} from './spatial-node.repository.js'
export { SpatialNodeRepository } from './spatial-node.repository.js'

// Runtime Snapshot Repository
export type {
  AtcSnapshotType,
  AtcRuntimeSnapshot,
  CreateSnapshotParams,
} from './runtime-snapshot.repository.js'
export { RuntimeSnapshotRepository } from './runtime-snapshot.repository.js'

// Spatial Ownership Repository
export type {
  AtcSpatialEntityType,
  AtcSpatialOwnership,
  ClaimOwnershipParams,
} from './spatial-ownership.repository.js'
export { SpatialOwnershipRepository } from './spatial-ownership.repository.js'

// Interest Region Repository
export type {
  AtcInterestRegionType,
  AtcInterestRegion,
  UpsertInterestRegionParams,
} from './interest-region.repository.js'
export { InterestRegionRepository } from './interest-region.repository.js'

// Streaming Runtime Repository
export type {
  AtcStreamingState,
  AtcStreamingRuntime,
  UpsertStreamingParams,
} from './streaming-runtime.repository.js'
export { StreamingRuntimeRepository } from './streaming-runtime.repository.js'

// Replication Audit Repository
export type { AtcReplicationAuditEntry } from './replication-audit.repository.js'
export { ReplicationAuditRepository } from './replication-audit.repository.js'

// Services
export type { ReplicationEventBus } from './spatial-ownership.service.js'
export { SpatialOwnershipService } from './spatial-ownership.service.js'
export { ReplicationRuntimeService } from './replication-runtime.service.js'
export { InterestManagementService } from './interest-management.service.js'
export { RuntimeStreamingService } from './runtime-streaming.service.js'
export { SpatialPartitionService } from './spatial-partition.service.js'
export { SnapshotSynchronizationService } from './snapshot-synchronization.service.js'
