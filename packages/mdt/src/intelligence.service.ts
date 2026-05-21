import type {
  AtcEntityNode,
  AtcEntityRelatedGraph,
  AtcCrossReference,
  AtcEntityNeighbor,
  AtcRelationshipKind,
} from '@atc/shared-types'
import type { AtcEntityGraphSDK } from '@atc/entity-graph'

export interface MdtIntelligenceServiceOptions {
  entityGraph: AtcEntityGraphSDK
}

export interface SubjectGraphResult {
  characterEntityId: string
  rootEntity: AtcEntityNode | null
  graph: AtcEntityRelatedGraph
  crossReferences: AtcCrossReference[]
  knownAssociates: AtcEntityNeighbor[]
}

const ASSOCIATE_RELATIONSHIPS: AtcRelationshipKind[] = [
  'character_associated_with_character',
  'character_member_of_organization',
  'character_involved_in_incident',
]

/**
 * MdtIntelligenceService — MDT-side façade over the entity-graph SDK.
 *
 * Wraps subject-graph aggregations for use by MDT clients without coupling
 * the dispatch/law repositories to the entity-graph package directly.
 *
 * READ ONLY.
 */
export class MdtIntelligenceService {
  constructor(private readonly opts: MdtIntelligenceServiceOptions) {}

  /** Resolves the canonical entity registry entry for a character ID. */
  async resolveCharacterEntity(characterId: string): Promise<AtcEntityNode | null> {
    if (!characterId) return null
    return this.opts.entityGraph.registry.getByTypeAndExternalId('character', characterId)
  }

  /** Returns the depth-N subject graph for a character. */
  async getSubjectGraph(characterId: string, depth = 2): Promise<SubjectGraphResult> {
    const rootEntity = await this.resolveCharacterEntity(characterId)
    if (!rootEntity) {
      return {
        characterEntityId: '',
        rootEntity: null,
        graph: { rootId: '', depth, nodes: [], edges: [], cyclesDetected: [], truncated: false },
        crossReferences: [],
        knownAssociates: [],
      }
    }

    const [graph, crossReferences, knownAssociates] = await Promise.all([
      this.opts.entityGraph.getRelated({ entityId: rootEntity.id, depth }),
      this.opts.entityGraph.getCrossReferences(rootEntity.id, 100),
      this.opts.entityGraph.getNeighbors(rootEntity.id, 100),
    ])

    // Filter known-associates to identity-style relationships only
    const associates = knownAssociates.filter((n) =>
      ASSOCIATE_RELATIONSHIPS.includes(n.edge.relationship),
    )

    return {
      characterEntityId: rootEntity.id,
      rootEntity,
      graph,
      crossReferences,
      knownAssociates: associates,
    }
  }

  /** Lists entities directly linked to the character (depth-1). */
  async getLinkedEntities(characterId: string): Promise<AtcEntityNeighbor[]> {
    const rootEntity = await this.resolveCharacterEntity(characterId)
    if (!rootEntity) return []
    return this.opts.entityGraph.getNeighbors(rootEntity.id, 100)
  }

  /** Lists known associates (depth-1, identity-relationships only). */
  async getKnownAssociates(characterId: string): Promise<AtcEntityNeighbor[]> {
    const all = await this.getLinkedEntities(characterId)
    return all.filter((n) => ASSOCIATE_RELATIONSHIPS.includes(n.edge.relationship))
  }
}
