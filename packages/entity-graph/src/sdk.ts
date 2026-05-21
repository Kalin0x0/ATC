import type {
  AtcEntityNode,
  AtcEntityType,
  AtcEntityRelationshipPage,
  AtcEntityRelatedGraph,
  AtcEntityHistoryPage,
  AtcEntitySearchResult,
  AtcEntityNeighbor,
  AtcCrossReference,
  AtcRelationshipKind,
} from '@atc/shared-types'
import { EntityRegistryService } from './registry.service.js'
import { RelationshipGraphService } from './graph.service.js'
import { EntitySearchService } from './search.service.js'
import type { EntityRegistryRepository } from './registry.repository.js'
import type { RelationshipRepository } from './relationship.repository.js'

export interface AtcEntityGraphSDKOptions {
  registry: EntityRegistryRepository
  relationships: RelationshipRepository
}

/**
 * AtcEntityGraphSDK — high-level facade over the entity-graph subsystem.
 *
 * Read methods are the public surface; indexing (register/addAlias/recordEdge)
 * lives on the underlying repositories for callers that explicitly opt in.
 */
export class AtcEntityGraphSDK {
  readonly registry: EntityRegistryService
  readonly graph: RelationshipGraphService
  readonly searchService: EntitySearchService

  constructor(opts: AtcEntityGraphSDKOptions) {
    this.registry = new EntityRegistryService({ repository: opts.registry })
    this.graph = new RelationshipGraphService({
      registry: opts.registry,
      relationships: opts.relationships,
    })
    this.searchService = new EntitySearchService({ registry: opts.registry })
  }

  search(params: {
    query: string
    types?: AtcEntityType[]
    limit?: number
    cursor?: string | null
  }): Promise<AtcEntitySearchResult> {
    return this.searchService.search(params)
  }

  getEntity(id: string): Promise<AtcEntityNode | null> {
    return this.registry.getById(id)
  }

  getRelationships(params: {
    entityId: string
    direction?: 'outbound' | 'inbound' | 'both'
    relationship?: AtcRelationshipKind
    limit?: number
    cursor?: string | null
    includeEnded?: boolean
  }): Promise<AtcEntityRelationshipPage> {
    return this.graph.getRelationships(params)
  }

  getHistory(
    entityId: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<AtcEntityHistoryPage> {
    return this.graph.getHistory(entityId, limit, cursor)
  }

  getRelated(params: {
    entityId: string
    depth?: number
    relationships?: AtcRelationshipKind[]
    includeEnded?: boolean
  }): Promise<AtcEntityRelatedGraph> {
    return this.graph.getRelated(params)
  }

  getNeighbors(entityId: string, limit?: number): Promise<AtcEntityNeighbor[]> {
    return this.graph.getNeighbors(entityId, limit)
  }

  getCrossReferences(entityId: string, limit?: number): Promise<AtcCrossReference[]> {
    return this.graph.getCrossReferences(entityId, limit)
  }
}
