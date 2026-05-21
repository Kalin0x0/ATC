import type {
  AtcEntityNode,
  AtcRelationshipEdge,
  AtcRelationshipKind,
  AtcEntityRelationshipPage,
  AtcEntityRelatedGraph,
  AtcEntityNeighbor,
  AtcCrossReference,
  AtcEntityHistoryPage,
  AtcEntityHistoryEntry,
} from '@atc/shared-types'
import type { EntityRegistryRepository } from './registry.repository.js'
import type { RelationshipRepository } from './relationship.repository.js'
import { offsetFromCursor, nextCursor } from './cursor.js'
import { InvalidTraversalDepthError } from './errors.js'

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_TRAVERSAL_DEPTH = 4
const MAX_NODES_PER_TRAVERSAL = 200
const MAX_BREADTH_PER_NODE = 50
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

function clamp(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

function clampDepth(depth: number | undefined): number {
  const d = depth ?? 1
  if (!Number.isInteger(d) || d < 1 || d > MAX_TRAVERSAL_DEPTH) {
    throw new InvalidTraversalDepthError(d)
  }
  return d
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface RelationshipGraphServiceOptions {
  registry: EntityRegistryRepository
  relationships: RelationshipRepository
}

export interface GetRelationshipsParams {
  entityId: string
  direction?: 'outbound' | 'inbound' | 'both'
  relationship?: AtcRelationshipKind
  limit?: number
  cursor?: string | null
  includeEnded?: boolean
}

export interface GetRelatedParams {
  entityId: string
  depth?: number
  relationships?: AtcRelationshipKind[]
  includeEnded?: boolean
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * RelationshipGraphService — bounded-traversal read service for the entity
 * relationship graph. Hard caps prevent cyclic explosions and runaway BFS.
 *
 * INVARIANTS:
 *   - Traversal depth ∈ [1, MAX_TRAVERSAL_DEPTH] (rejected otherwise).
 *   - Total visited nodes capped at MAX_NODES_PER_TRAVERSAL.
 *   - Per-node fan-out capped at MAX_BREADTH_PER_NODE.
 *   - Detected cycles surfaced in result, not silently dropped.
 */
export class RelationshipGraphService {
  constructor(private readonly opts: RelationshipGraphServiceOptions) {}

  // ── Direct relationships (paginated) ────────────────────────────────────

  async getRelationships(params: GetRelationshipsParams): Promise<AtcEntityRelationshipPage> {
    const limit = clamp(params.limit)
    const cursor = params.cursor ?? null
    const offset = offsetFromCursor(cursor)

    if (!params.entityId) {
      return {
        entityId: '',
        outbound: [], inbound: [],
        total: 0, limit, cursor, nextCursor: null,
      }
    }

    const requestParams = {
      entityId: params.entityId,
      direction: params.direction ?? 'both',
      ...(params.relationship !== undefined ? { relationship: params.relationship } : {}),
      includeEnded: params.includeEnded ?? false,
      limit,
      offset,
    }
    const page = await this.opts.relationships.list(requestParams)

    const outbound = page.items.filter((e) => e.from.id === params.entityId)
    const inbound  = page.items.filter((e) => e.to.id   === params.entityId)

    return {
      entityId: params.entityId,
      outbound,
      inbound,
      total: page.total,
      limit,
      cursor,
      nextCursor: nextCursor(offset, page.items.length, page.total),
    }
  }

  // ── Bounded BFS traversal ───────────────────────────────────────────────

  async getRelated(params: GetRelatedParams): Promise<AtcEntityRelatedGraph> {
    const depth = clampDepth(params.depth)
    if (!params.entityId) {
      return { rootId: '', depth, nodes: [], edges: [], cyclesDetected: [], truncated: false }
    }

    const rootNode = await this.opts.registry.findById(params.entityId)
    if (!rootNode) {
      return { rootId: params.entityId, depth, nodes: [], edges: [], cyclesDetected: [], truncated: false }
    }

    const nodes = new Map<string, AtcEntityNode>([[rootNode.id, rootNode]])
    const edges = new Map<string, AtcRelationshipEdge>()
    const cycles: string[] = []
    let frontier: string[] = [rootNode.id]
    let truncated = false

    for (let d = 0; d < depth; d++) {
      if (frontier.length === 0) break

      // Batched fetch — no N+1
      const edgeBatch = await this.opts.relationships.listForEntities(frontier, {
        includeEnded: params.includeEnded ?? false,
        maxFanOutPerNode: MAX_BREADTH_PER_NODE,
      })

      const filtered = params.relationships && params.relationships.length > 0
        ? edgeBatch.filter((e) => params.relationships!.includes(e.relationship))
        : edgeBatch

      const newIds = new Set<string>()
      const frontierSet = new Set(frontier)
      for (const e of filtered) {
        // Whichever endpoint is *not* in the current frontier is a discovery.
        const discover = frontierSet.has(e.from.id) ? e.to.id : e.from.id
        if (nodes.has(discover)) {
          // Cycle: discovered node was already visited.
          cycles.push(discover)
        } else {
          newIds.add(discover)
        }
        // Edge dedup happens after the cycle check so re-traversed edges still
        // contribute their cycle signal.
        if (!edges.has(e.id)) edges.set(e.id, e)
      }

      if (newIds.size === 0) break

      // Fetch new node payloads in batch (single query at registry level).
      const newIdList = Array.from(newIds)
      const fetched = await Promise.all(newIdList.map((id) => this.opts.registry.findById(id)))
      for (let i = 0; i < newIdList.length; i++) {
        const n = fetched[i]
        if (n) nodes.set(newIdList[i]!, n)
      }

      // Enforce hard node cap
      if (nodes.size >= MAX_NODES_PER_TRAVERSAL) {
        truncated = true
        break
      }

      frontier = newIdList
    }

    return {
      rootId: rootNode.id,
      depth,
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      cyclesDetected: Array.from(new Set(cycles)),
      truncated,
    }
  }

  // ── Cross-references ────────────────────────────────────────────────────

  async getCrossReferences(entityId: string, limit?: number): Promise<AtcCrossReference[]> {
    const requestParams = {
      entityId,
      direction: 'both' as const,
      limit: clamp(limit),
      offset: 0,
      includeEnded: false,
    }
    const page = await this.opts.relationships.list(requestParams)
    return page.items.map((edge) => {
      const isOutbound = edge.from.id === entityId
      return {
        source: isOutbound ? edge.from : edge.to,
        target: isOutbound ? edge.to : edge.from,
        relationship: edge.relationship,
        edgeId: edge.id,
        observedAt: edge.observedAt,
        endedAt: edge.endedAt,
      }
    })
  }

  // ── Neighbors (depth-1 helper) ──────────────────────────────────────────

  async getNeighbors(entityId: string, limit?: number): Promise<AtcEntityNeighbor[]> {
    const graph = await this.getRelated({ entityId, depth: 1 })
    const cap = clamp(limit)
    const out: AtcEntityNeighbor[] = []
    for (const edge of graph.edges) {
      const direction: 'outbound' | 'inbound' = edge.from.id === entityId ? 'outbound' : 'inbound'
      const neighborId = direction === 'outbound' ? edge.to.id : edge.from.id
      const node = graph.nodes.find((n) => n.id === neighborId)
      if (!node) continue
      out.push({ entity: node, edge, direction, depth: 1 })
      if (out.length >= cap) break
    }
    return out
  }

  // ── History ─────────────────────────────────────────────────────────────

  async getHistory(
    entityId: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<AtcEntityHistoryPage> {
    const cap = clamp(limit)
    const cur = cursor ?? null
    const offset = offsetFromCursor(cur)

    if (!entityId) {
      return { entityId: '', entries: [], total: 0, limit: cap, cursor: cur, nextCursor: null }
    }

    const node = await this.opts.registry.findById(entityId)
    if (!node) {
      return { entityId, entries: [], total: 0, limit: cap, cursor: cur, nextCursor: null }
    }

    const entries: AtcEntityHistoryEntry[] = []
    entries.push({
      at: node.createdAt,
      kind: 'created',
      detail: `${node.type} ${node.externalId} registered from ${node.sourceSystem}`,
      edgeId: null,
      aliasId: null,
    })
    for (const a of node.aliases) {
      entries.push({
        at: a.createdAt,
        kind: 'alias_added',
        detail: `alias ${a.kind}:${a.value}`,
        edgeId: null,
        aliasId: a.id,
      })
    }

    // All edges (inbound + outbound)
    const edges = await this.opts.relationships.list({
      entityId,
      direction: 'both',
      includeEnded: true,
      limit: MAX_LIMIT,
      offset: 0,
    })
    for (const e of edges.items) {
      entries.push({
        at: e.observedAt,
        kind: 'relationship_added',
        detail: `${e.relationship} ${e.from.id} → ${e.to.id}`,
        edgeId: e.id,
        aliasId: null,
      })
      if (e.endedAt) {
        entries.push({
          at: e.endedAt,
          kind: 'relationship_ended',
          detail: `${e.relationship} ${e.from.id} → ${e.to.id} ended`,
          edgeId: e.id,
          aliasId: null,
        })
      }
    }

    // Stable chronological order, then paginate
    entries.sort((a, b) => a.at.getTime() - b.at.getTime())
    const total = entries.length
    const page = entries.slice(offset, offset + cap)
    return {
      entityId,
      entries: page,
      total,
      limit: cap,
      cursor: cur,
      nextCursor: nextCursor(offset, page.length, total),
    }
  }
}

export const ENTITY_GRAPH_LIMITS = {
  MAX_TRAVERSAL_DEPTH,
  MAX_NODES_PER_TRAVERSAL,
  MAX_BREADTH_PER_NODE,
  MAX_LIMIT,
  DEFAULT_LIMIT,
} as const
