// Pool
export type { PoolConnection, GlobalGovernancePool } from './pool.js'

// ID generator
export { generateId } from './id.js'

// Errors
export {
  GlobalGovernanceRuntimeError,
  GovernanceDirectiveNotFoundError,
  DuplicateGovernanceDirectiveError,
  ArbitrationNotFoundError,
  ConsensusNotFoundError,
  PolicyNotFoundError,
  OwnershipNotFoundError,
} from './errors.js'

// Global Governance Repository
export type {
  AtcGovernanceDirectiveType,
  AtcGovernanceDirectiveStatus,
  AtcGlobalGovernance,
  CreateGovernanceDirectiveParams,
} from './global-governance.repository.js'
export { GlobalGovernanceRepository } from './global-governance.repository.js'

// Cross-System Arbitration Repository
export type {
  AtcArbitrationType,
  AtcArbitrationStatus,
  AtcCrossSystemArbitration,
  CreateArbitrationParams,
} from './crosssystem-arbitration.repository.js'
export { CrossSystemArbitrationRepository } from './crosssystem-arbitration.repository.js'

// Runtime Consensus Repository
export type {
  AtcConsensusType,
  AtcConsensusStatus,
  AtcRuntimeConsensus,
  CreateConsensusParams,
} from './runtime-consensus.repository.js'
export { RuntimeConsensusRepository } from './runtime-consensus.repository.js'

// Global Policy Repository
export type {
  AtcPolicyType,
  AtcPolicyStatus,
  AtcGlobalPolicy,
  UpsertPolicyParams,
} from './global-policy.repository.js'
export { GlobalPolicyRepository } from './global-policy.repository.js'

// Global Ownership Repository
export type {
  AtcOwnershipType,
  AtcOwnershipStatus,
  AtcGlobalOwnership,
  UpsertOwnershipParams,
} from './global-ownership.repository.js'
export { GlobalOwnershipRepository } from './global-ownership.repository.js'

// Governance Continuity Audit Repository
export type { AtcGovernanceContinuityAuditEntry } from './governance-continuity-audit.repository.js'
export { GovernanceContinuityAuditRepository } from './governance-continuity-audit.repository.js'

// Services
export type { GlobalGovernanceEventBus, GlobalGovernanceCleanupResult } from './governance-continuity.service.js'
export { GovernanceContinuityService } from './governance-continuity.service.js'

export type { CreateDirectiveParams } from './global-governance.service.js'
export { GlobalGovernanceService } from './global-governance.service.js'

export type { StartArbitrationParams } from './crosssystem-arbitration.service.js'
export { CrossSystemArbitrationService } from './crosssystem-arbitration.service.js'

export type { ProposeConsensusParams } from './runtime-consensus.service.js'
export { RuntimeConsensusService } from './runtime-consensus.service.js'

export type { UpsertPolicyServiceParams } from './distributed-policy.service.js'
export { DistributedPolicyCoordinator } from './distributed-policy.service.js'

export type { ClaimOwnershipParams } from './global-ownership.service.js'
export { GlobalOwnershipAuthority } from './global-ownership.service.js'
