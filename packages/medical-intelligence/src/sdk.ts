import type {
  MedicalReadRepositories,
  MedicalTimelinePage,
  ClinicalHistorySummary,
  TraumaAnalyticsResult,
  ResponderHistorySummary,
  MedicalRiskScore,
  IncidentMedicalCorrelation,
} from './types.js'
import { MedicalTimelineService } from './timeline.service.js'
import { TraumaAnalyticsService } from './analytics.service.js'
import { InvestigationCorrelationService } from './correlation.service.js'
import { MedicalRiskService } from './risk.service.js'

export interface AtcMedicalIntelligenceSDKOptions {
  repos: MedicalReadRepositories
}

/**
 * AtcMedicalIntelligenceSDK — read-only investigative analytics layered on
 * top of the medical repository interfaces. No writes, no event emission.
 */
export class AtcMedicalIntelligenceSDK {
  readonly timeline: MedicalTimelineService
  readonly analytics: TraumaAnalyticsService
  readonly correlation: InvestigationCorrelationService
  readonly risk: MedicalRiskService

  constructor(opts: AtcMedicalIntelligenceSDKOptions) {
    this.timeline = new MedicalTimelineService({ repos: opts.repos })
    this.analytics = new TraumaAnalyticsService({ repos: opts.repos })
    this.correlation = new InvestigationCorrelationService({ repos: opts.repos })
    this.risk = new MedicalRiskService({ repos: opts.repos })
  }

  getHistory(characterId: string): Promise<ClinicalHistorySummary> {
    return this.analytics.getClinicalHistory(characterId)
  }

  getTimeline(characterId: string, options: {
    limit?: number
    cursor?: string | null
    since?: Date | null
    until?: Date | null
  } = {}): Promise<MedicalTimelinePage> {
    return this.timeline.getTimeline(characterId, options)
  }

  getRisk(characterId: string, windowDays?: number): Promise<MedicalRiskScore> {
    return this.risk.computeRisk(characterId, windowDays)
  }

  getAnalytics(characterId: string, windowDays?: number): Promise<TraumaAnalyticsResult> {
    return this.analytics.getTraumaAnalytics(characterId, windowDays)
  }

  getResponderHistory(principalId: string, windowDays?: number): Promise<ResponderHistorySummary> {
    return this.analytics.getResponderHistory(principalId, windowDays)
  }

  getIncidentCorrelation(incidentId: string): Promise<IncidentMedicalCorrelation> {
    return this.correlation.getIncidentCorrelation(incidentId)
  }
}

export type MedicalIntelligenceService = AtcMedicalIntelligenceSDK
