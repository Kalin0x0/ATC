import type {
  EntityRegistryRepository,
  RelationshipRepository,
} from '@atc/entity-graph'
import { EntityCorrelationService } from './correlation.service.js'
import type { AssociateResult, ClusterResult, RiskScoreResult } from './correlation.service.js'
import { TemporalGraphService } from './temporal.service.js'
import type { TimelinePage, HistoricalGraphResult } from './temporal.service.js'

export interface AtcEntityIntelligenceSDKOptions {
  registry: EntityRegistryRepository
  relationships: RelationshipRepository
}

/**
 * AtcEntityIntelligenceSDK — convenience facade aggregating the Phase 28
 * read-only intelligence services. Intentionally distinct from
 * AtcEntityGraphSDK (Phase 27) so the analytics layer can evolve without
 * touching the core graph SDK contract.
 */
export class AtcEntityIntelligenceSDK {
  readonly correlation: EntityCorrelationService
  readonly temporal: TemporalGraphService

  constructor(opts: AtcEntityIntelligenceSDKOptions) {
    this.correlation = new EntityCorrelationService(opts)
    this.temporal = new TemporalGraphService(opts)
  }

  getTimeline(entityId: string, opts: {
    limit?: number
    cursor?: string | null
    since?: Date | null
    until?: Date | null
  } = {}): Promise<TimelinePage> {
    return this.temporal.getTimeline(entityId, opts)
  }

  getAssociates(entityId: string, limit?: number): Promise<AssociateResult[]> {
    return this.correlation.getKnownAssociates(entityId, limit)
  }

  getRisk(entityId: string): Promise<RiskScoreResult> {
    return this.correlation.computeRiskScore(entityId)
  }

  getClusters(entityId: string): Promise<ClusterResult> {
    return this.correlation.getCluster(entityId)
  }

  getHistoricalGraph(entityId: string, asOf: Date, depth?: number): Promise<HistoricalGraphResult> {
    return this.temporal.getHistoricalGraph(entityId, asOf, depth ?? 1)
  }
}
