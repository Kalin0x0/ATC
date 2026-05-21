import type {
  EntityRegistryRepository,
  RelationshipRepository,
} from '@atc/entity-graph'
import type {
  AtcEntityType,
  AtcRelationshipKind,
  AtcEntityNode,
  AtcRelationshipEdge,
} from '@atc/shared-types'

export interface RelationshipProjectionServiceOptions {
  registry: EntityRegistryRepository
  relationships: RelationshipRepository
  sourceSystem?: string
}

export interface ProjectionInput {
  from: { type: AtcEntityType; externalId: string; displayName?: string | null }
  to: { type: AtcEntityType; externalId: string; displayName?: string | null }
  relationship: AtcRelationshipKind
  weight?: number
  attribution?: string | null
  metadata?: Record<string, unknown> | null
  observedAt?: Date
}

/**
 * RelationshipProjectionService — projects domain events into the entity
 * graph as canonical entity nodes + typed relationship edges.
 *
 * INVARIANTS:
 * - Idempotent on (from, to, relationship) pairs (suppresses duplicates).
 * - Fail-soft: never throws into the caller event handler.
 * - Read source domain data only via shared types; never mutates source systems.
 */
export class RelationshipProjectionService {
  private readonly registry: EntityRegistryRepository
  private readonly relationships: RelationshipRepository
  private readonly sourceSystem: string

  constructor(opts: RelationshipProjectionServiceOptions) {
    this.registry = opts.registry
    this.relationships = opts.relationships
    this.sourceSystem = opts.sourceSystem ?? 'entity-correlation'
  }

  /**
   * Ensures both endpoints exist in the registry then records the edge.
   * Returns the edge if newly created, or null if a duplicate was detected.
   */
  async project(input: ProjectionInput): Promise<AtcRelationshipEdge | null> {
    try {
      const [from, to] = await Promise.all([
        this.registry.register({
          type: input.from.type,
          externalId: input.from.externalId,
          ...(input.from.displayName !== undefined ? { displayName: input.from.displayName } : {}),
          sourceSystem: this.sourceSystem,
        }),
        this.registry.register({
          type: input.to.type,
          externalId: input.to.externalId,
          ...(input.to.displayName !== undefined ? { displayName: input.to.displayName } : {}),
          sourceSystem: this.sourceSystem,
        }),
      ])

      // Duplicate suppression — skip if an active edge of the same kind already exists.
      const existing = await this.relationships.list({
        entityId: from.id,
        direction: 'outbound',
        relationship: input.relationship,
        includeEnded: false,
        limit: 100,
        offset: 0,
      })
      const dup = existing.items.find((e) => e.to.id === to.id)
      if (dup) return null

      const edge = await this.relationships.recordEdge({
        fromEntityId: from.id,
        toEntityId: to.id,
        relationship: input.relationship,
        weight: input.weight ?? 1,
        sourceSystem: this.sourceSystem,
        attribution: input.attribution ?? null,
        metadata: input.metadata ?? null,
        observedAt: input.observedAt ?? new Date(),
      })
      return edge
    } catch {
      // Fail-soft: ingestion errors must never break source-system event flow.
      return null
    }
  }

  /**
   * Marks an active edge of the given kind between two entities as ended.
   * Used when source events indicate a relationship has concluded
   * (e.g. responder cleared, contract terminated). Fail-soft.
   */
  async endProjection(input: {
    from: { type: AtcEntityType; externalId: string }
    to: { type: AtcEntityType; externalId: string }
    relationship: AtcRelationshipKind
    endedAt?: Date
  }): Promise<void> {
    try {
      const [fromNode, toNode] = await Promise.all([
        this.registry.findByTypeAndExternalId(input.from.type, input.from.externalId),
        this.registry.findByTypeAndExternalId(input.to.type, input.to.externalId),
      ])
      if (!fromNode || !toNode) return

      const page = await this.relationships.list({
        entityId: fromNode.id,
        direction: 'outbound',
        relationship: input.relationship,
        includeEnded: false,
        limit: 100,
        offset: 0,
      })
      const target = page.items.find((e) => e.to.id === toNode.id)
      if (!target) return
      await this.relationships.endEdge(target.id, input.endedAt ?? new Date())
    } catch {
      // Fail-soft
    }
  }

  /** Resolve canonical node lazily — used by callers needing the entity later. */
  resolveCanonical(type: AtcEntityType, externalId: string): Promise<AtcEntityNode | null> {
    return this.registry.findByTypeAndExternalId(type, externalId)
  }
}
