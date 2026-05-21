// Pool types
export type { PoolConnection, AiRuntimePool } from './pool.js'

// ID generation
export { generateId } from './id.js'

// Errors
export {
  AiRuntimeError,
  AiEntityNotFoundError,
  PatrolNotFoundError,
  DuplicatePatrolNonceError,
  PatrolAlreadyActiveError,
  ThreatAssessmentNotFoundError,
  ReinforcementNotFoundError,
  DuplicateReinforcementNonceError,
  AiResponseNotFoundError,
  AiResponseAlreadyActiveError,
} from './errors.js'

// AI Runtime Repository
export type {
  AtcAiEntityType,
  AtcAiState,
  AtcAiBehaviorMode,
  AtcAiRuntime,
  UpsertAiRuntimeParams,
} from './ai-runtime.repository.js'
export { AiRuntimeRepository } from './ai-runtime.repository.js'

// AI Patrol Repository
export type {
  AtcPatrolType,
  AtcPatrolStatus,
  AtcAiPatrol,
  CreatePatrolParams,
} from './ai-patrol.repository.js'
export { AiPatrolRepository } from './ai-patrol.repository.js'

// AI Threat Assessment Repository
export type {
  AtcThreatType,
  AtcThreatLevel,
  AtcAiThreatAssessment,
  UpsertThreatAssessmentParams,
} from './ai-threat-assessment.repository.js'
export { AiThreatAssessmentRepository } from './ai-threat-assessment.repository.js'

// AI Reinforcement Repository
export type {
  AtcReinforcementType,
  AtcReinforcementStatus,
  AtcAiReinforcement,
  CreateReinforcementParams,
} from './ai-reinforcement.repository.js'
export { AiReinforcementRepository } from './ai-reinforcement.repository.js'

// AI Response Runtime Repository
export type {
  AtcAiResponseType,
  AtcAiResponseStatus,
  AtcAiResponseRuntime,
  CreateAiResponseParams,
} from './ai-response-runtime.repository.js'
export { AiResponseRuntimeRepository } from './ai-response-runtime.repository.js'

// AI Audit Repository
export type { AiAuditRecord } from './ai-audit.repository.js'
export { AiAuditRepository } from './ai-audit.repository.js'

// Services
export type { AiRuntimeEventBus } from './ai-runtime.service.js'
export { AiRuntimeService } from './ai-runtime.service.js'
export { TacticalResponseService } from './tactical-response.service.js'
export { AutonomousPatrolService } from './autonomous-patrol.service.js'
export { ThreatAssessmentService } from './threat-assessment.service.js'
export { ReinforcementCoordinationService } from './reinforcement-coordination.service.js'
export type { FullCleanupResult } from './ai-recovery.service.js'
export { AiRecoveryService } from './ai-recovery.service.js'
