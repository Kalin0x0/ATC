export type {
  MedicalReadRepositories,
  MedicalTimelineKind,
  MedicalTimelineEntry,
  MedicalTimelinePage,
  ClinicalHistorySummary,
  TraumaAnalyticsResult,
  MedicalRiskScore,
  ResponderHistorySummary,
  IncidentMedicalCorrelation,
} from './types.js'

export { MEDICAL_INTEL_LIMITS, MEDICAL_SEVERITY_WEIGHTS } from './limits.js'

export {
  encodeCursor,
  decodeCursor,
  nextCursor,
} from './cursor.js'

export {
  MedicalTimelineService,
  type MedicalTimelineServiceOptions,
} from './timeline.service.js'

export {
  TraumaAnalyticsService,
  SEVERITY_ORDER,
  type TraumaAnalyticsServiceOptions,
} from './analytics.service.js'

export {
  InvestigationCorrelationService,
  type InvestigationCorrelationServiceOptions,
} from './correlation.service.js'

export {
  MedicalRiskService,
  type MedicalRiskServiceOptions,
} from './risk.service.js'

export {
  AtcMedicalIntelligenceSDK,
  type AtcMedicalIntelligenceSDKOptions,
  type MedicalIntelligenceService,
} from './sdk.js'
