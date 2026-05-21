// Pool types
export type { PoolConnection, NarrativeRuntimePool } from './pool.js'

// ID utility
export { generateId } from './id.js'

// Errors
export {
  NarrativeRuntimeError,
  CampaignNotFoundError,
  DuplicateCampaignError,
  WorldEventNotFoundError,
  StoryProgressionNotFoundError,
  NarrativeSessionNotFoundError,
  DynamicStoryNotFoundError,
  CampaignAlreadyActiveError,
} from './errors.js'

// Campaign runtime repository
export type {
  AtcCampaignType,
  AtcCampaignStatus,
  AtcCampaignRecord,
  CreateCampaignParams,
} from './campaign-runtime.repository.js'
export { CampaignRuntimeRepository } from './campaign-runtime.repository.js'

// World event repository
export type {
  AtcWorldEventType,
  AtcWorldEventStatus,
  AtcWorldEvent,
  CreateWorldEventParams,
} from './world-event.repository.js'
export { WorldEventRepository } from './world-event.repository.js'

// Story progression repository
export type {
  AtcProgressionType,
  AtcStoryProgression,
  CreateProgressionParams,
} from './story-progression.repository.js'
export { StoryProgressionRepository } from './story-progression.repository.js'

// Narrative session repository
export type {
  AtcNarrativeType,
  AtcNarrativeStatus,
  AtcNarrativeSession,
  CreateNarrativeSessionParams,
} from './narrative-session.repository.js'
export { NarrativeSessionRepository } from './narrative-session.repository.js'

// Dynamic story state repository
export type {
  AtcStoryStateType,
  AtcDynamicStoryState,
  UpsertStoryStateParams,
} from './dynamic-story-state.repository.js'
export { DynamicStoryStateRepository } from './dynamic-story-state.repository.js'

// Narrative audit repository
export type {
  AtcNarrativeAuditEntry,
  AppendAuditParams,
} from './narrative-audit.repository.js'
export { NarrativeAuditRepository } from './narrative-audit.repository.js'

// Services
export type { NarrativeEventBus } from './narrative-runtime.service.js'
export { NarrativeRuntimeService } from './narrative-runtime.service.js'
export { CampaignOrchestrationService } from './campaign-orchestration.service.js'
export { WorldEventService } from './world-event.service.js'
export { StoryProgressionService } from './story-progression.service.js'
export { DynamicNarrativeService } from './dynamic-narrative.service.js'
export { NarrativeRecoveryService } from './narrative-recovery.service.js'
