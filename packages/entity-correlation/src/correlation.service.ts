import type {
  AtcEntityNode,
  AtcRelationshipEdge,
  AtcRelationshipKind,
} from '@atc/shared-types'
import type {
  EntityRegistryRepository,
  RelationshipRepository,
} from '@atc/entity-graph'
import { CORRELATION_LIMITS } from './limits.js'

export interface EntityCorrelationServiceOptions {
  registry: EntityRegistryRepository
  relationships: RelationshipRepository
}

export interface AssociateResult {
  entity: AtcEntityNode
  sharedEntities: AtcEntityNode[]
  /** Heuristic strength based on count of shared neighbors. */
  confidence: number
}

export interface ClusterResult {
  rootId: string
  /** Connected component reachable from the root entity (bounded). */
  nodes: AtcEntityNode[]
  edges: AtcRelationshipEdge[]
  size: number
  truncated: boolean
}

export interface RiskScoreResult {
  entityId: string
  score: number
  factors: {
    warrantCount: number
    arrestCount: number
    citationCount: number
    incidentDensity: number
    knownAssociatesCount: number
    relationshipFrequency: number
  }
}

const ASSOCIATE_KINDS: AtcRelationshipKind[] = [
  'character_associated_with_character',
  'character_member_of_organization',
  'character_involved_in_incident',
]

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/**
 * EntityCorrelationService — read-only investigative analytics.
 *
 * All queries are bounded by CORRELATION_LIMITS. Confidence scores are
 * heuristic and intentionally bounded in [0, 1] so downstream UI can render
 * them as percentages without further normalization.
 */
export class EntityCorrelationService {
  private readonly registry: EntityRegistryRepository
  private readonly relationships: RelationshipRepository

  constructor(opts: EntityCorrelationServiceOptions) {
    this.registry = opts.registry
    this.relationships = opts.relationships
  }

  // ── Known associates (depth-1 + shared-incidents co-occurrence) ─────────

  async getKnownAssociates(entityId: string, limit?: number): Promise<AssociateResult[]> {
    if (!entityId) return []
    const cap = Math.min(limit ?? CORRELATION_LIMITS.DEFAULT_LIMIT, CORRELATION_LIMITS.MAX_ASSOCIATES)
    const root = await this.registry.findById(entityId)
    if (!root) return []

    // 1. Direct outbound edges of associate kinds.
    const direct = await this.relationships.list({
      entityId,
      direction: 'both',
      includeEnded: false,
      limit: CORRELATION_LIMITS.MAX_LIMIT,
      offset: 0,
    })
    const candidateIds = new Set<string>()
    for (const e of direct.items) {
      if (!ASSOCIATE_KINDS.includes(e.relationship)) continue
      const other = e.from.id === entityId ? e.to.id : e.from.id
      if (other && other !== entityId) candidateIds.add(other)
    }

    // 2. Shared-incident co-occurrence (depth-2 over 'character_involved_in_incident')
    const incidentEdges = direct.items.filter(
      (e) => e.relationship === 'character_involved_in_incident',
    )
    const incidentIds = Array.from(
      new Set(incidentEdges.map((e) => (e.from.id === entityId ? e.to.id : e.from.id))),
    ).slice(0, CORRELATION_LIMITS.MAX_BREADTH_PER_NODE)

    if (incidentIds.length > 0) {
      const incidentNeighbors = await this.relationships.listForEntities(incidentIds, {
        includeEnded: false,
        maxFanOutPerNode: CORRELATION_LIMITS.MAX_BREADTH_PER_NODE,
      })
      for (const e of incidentNeighbors) {
        if (e.relationship !== 'character_involved_in_incident') continue
        const other = incidentIds.includes(e.from.id) ? e.to.id : e.from.id
        if (other && other !== entityId) candidateIds.add(other)
      }
    }

    // 3. Hydrate candidates and compute confidence.
    const ids = Array.from(candidateIds).slice(0, cap)
    const hydrated = await Promise.all(ids.map((id) => this.registry.findById(id)))

    const out: AssociateResult[] = []
    for (let i = 0; i < ids.length; i++) {
      const entity = hydrated[i]
      if (!entity) continue
      const sharedCount = direct.items.filter((e) =>
        ASSOCIATE_KINDS.includes(e.relationship) &&
        (e.from.id === entity.id || e.to.id === entity.id),
      ).length
      out.push({
        entity,
        sharedEntities: [],
        confidence: clamp01(0.5 + sharedCount * 0.1),
      })
    }
    return out
  }

  // ── Cluster (bounded connected component) ───────────────────────────────

  async getCluster(entityId: string): Promise<ClusterResult> {
    if (!entityId) {
      return { rootId: '', nodes: [], edges: [], size: 0, truncated: false }
    }
    const root = await this.registry.findById(entityId)
    if (!root) {
      return { rootId: entityId, nodes: [], edges: [], size: 0, truncated: false }
    }

    const nodes = new Map<string, AtcEntityNode>([[root.id, root]])
    const edges = new Map<string, AtcRelationshipEdge>()
    let frontier: string[] = [root.id]
    let truncated = false

    for (let d = 0; d < CORRELATION_LIMITS.MAX_DEPTH; d++) {
      if (frontier.length === 0) break

      const batch = await this.relationships.listForEntities(frontier, {
        includeEnded: false,
        maxFanOutPerNode: CORRELATION_LIMITS.MAX_BREADTH_PER_NODE,
      })

      const frontierSet = new Set(frontier)
      const newIds = new Set<string>()
      for (const e of batch) {
        if (!edges.has(e.id)) edges.set(e.id, e)
        const discover = frontierSet.has(e.from.id) ? e.to.id : e.from.id
        if (!nodes.has(discover)) newIds.add(discover)
      }

      const newList = Array.from(newIds)
      const hydrated = await Promise.all(newList.map((id) => this.registry.findById(id)))
      for (let i = 0; i < newList.length; i++) {
        const n = hydrated[i]
        if (n) nodes.set(newList[i]!, n)
      }

      if (nodes.size >= CORRELATION_LIMITS.MAX_NODES) {
        truncated = true
        break
      }
      if (newList.length === 0) break
      frontier = newList
    }

    const nodeList = Array.from(nodes.values()).slice(0, CORRELATION_LIMITS.MAX_CLUSTER_SIZE)
    return {
      rootId: root.id,
      nodes: nodeList,
      edges: Array.from(edges.values()),
      size: nodes.size,
      truncated,
    }
  }

  // ── Risk score (composite) ──────────────────────────────────────────────

  async computeRiskScore(entityId: string): Promise<RiskScoreResult> {
    const empty = {
      entityId,
      score: 0,
      factors: {
        warrantCount: 0, arrestCount: 0, citationCount: 0,
        incidentDensity: 0, knownAssociatesCount: 0, relationshipFrequency: 0,
      },
    }
    if (!entityId) return empty
    const root = await this.registry.findById(entityId)
    if (!root) return { ...empty, entityId }

    const allEdges = await this.relationships.list({
      entityId, direction: 'both', includeEnded: true,
      limit: CORRELATION_LIMITS.MAX_LIMIT, offset: 0,
    })

    const factors = empty.factors
    const seenAssociates = new Set<string>()
    for (const e of allEdges.items) {
      const other = e.from.id === entityId ? e.to.id : e.from.id
      if (e.relationship === 'character_subject_of_warrant')  factors.warrantCount++
      if (e.relationship === 'character_subject_of_arrest')   factors.arrestCount++
      if (e.relationship === 'character_subject_of_citation') factors.citationCount++
      if (e.relationship === 'character_involved_in_incident') factors.incidentDensity++
      if (ASSOCIATE_KINDS.includes(e.relationship)) seenAssociates.add(other)
    }
    factors.knownAssociatesCount = seenAssociates.size
    factors.relationshipFrequency = allEdges.total

    // Composite score: weighted sum normalized to [0, 1] via sigmoid-ish clamp.
    const raw =
      factors.warrantCount        * 0.30 +
      factors.arrestCount         * 0.25 +
      factors.citationCount       * 0.05 +
      factors.incidentDensity     * 0.15 +
      factors.knownAssociatesCount * 0.10 +
      factors.relationshipFrequency * 0.02

    return { entityId, score: clamp01(raw / 10), factors }
  }
}
