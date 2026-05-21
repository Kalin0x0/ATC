// Phase 28 — Automatic Entity Correlation & Intelligence Producers (read/index)

export {
  RelationshipProjectionService,
  type RelationshipProjectionServiceOptions,
  type ProjectionInput,
} from './projection.service.js'

export {
  CorrelationIngestService,
  type CorrelationIngestServiceOptions,
  type IngestSubscription,
} from './ingest.service.js'

export {
  EntityCorrelationService,
  type EntityCorrelationServiceOptions,
  type AssociateResult,
  type ClusterResult,
  type RiskScoreResult,
} from './correlation.service.js'

export {
  TemporalGraphService,
  type TemporalGraphServiceOptions,
  type TimelineEntry,
  type TimelinePage,
  type HistoricalGraphResult,
} from './temporal.service.js'

export { CORRELATION_LIMITS } from './limits.js'

export {
  AtcEntityIntelligenceSDK,
  type AtcEntityIntelligenceSDKOptions,
} from './sdk.js'
