// Pool
export type { PoolConnection, FederationRuntimePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  FederationRuntimeError,
  FederationNodeNotFoundError,
  DuplicateFederationNodeError,
  InterclusterRouteNotFoundError,
  DuplicateInterclusterRouteError,
  ConsistencyCheckNotFoundError,
  DuplicateConsistencyCheckError,
} from './errors.js'

// Federation Node Repository
export type {
  AtcFederationNodeType,
  AtcFederationNodeStatus,
  AtcFederationNode,
  RegisterFederationNodeParams,
} from './federation-node.repository.js'
export { FederationNodeRepository } from './federation-node.repository.js'

// Region Runtime Repository
export type {
  AtcRegionType,
  AtcRegionStatus,
  AtcRegionRuntime,
  UpsertRegionParams,
} from './region-runtime.repository.js'
export { RegionRuntimeRepository } from './region-runtime.repository.js'

// Intercluster Route Repository
export type {
  AtcRouteType,
  AtcRouteStatus,
  AtcInterclusterRoute,
  CreateRouteParams,
} from './intercluster-route.repository.js'
export { InterclusterRouteRepository } from './intercluster-route.repository.js'

// Federation Ownership Repository
export type {
  AtcOwnershipType,
  AtcOwnershipStatus,
  AtcFederationOwnership,
  ClaimOwnershipParams,
} from './federation-ownership.repository.js'
export { FederationOwnershipRepository } from './federation-ownership.repository.js'

// Regional Consistency Repository
export type {
  AtcConsistencyCheckType,
  AtcConsistencyCheckStatus,
  AtcRegionalConsistency,
  CreateConsistencyCheckParams,
} from './regional-consistency.repository.js'
export { RegionalConsistencyRepository } from './regional-consistency.repository.js'

// Federation Audit Repository
export type {
  AtcFederationAuditEntry,
  AppendFederationAuditParams,
} from './federation-audit.repository.js'
export { FederationAuditRepository } from './federation-audit.repository.js'

// Services
export type { FederationRuntimeEventBus } from './federation-recovery.service.js'
export { FederationRuntimeService } from './federation-runtime.service.js'
export { MultiRegionSyncService } from './multi-region-sync.service.js'
export { InterclusterRoutingService } from './intercluster-routing.service.js'
export { FederationOwnershipService } from './federation-ownership.service.js'
export { RegionalConsistencyService } from './regional-consistency.service.js'
export { FederationRecoveryService } from './federation-recovery.service.js'
