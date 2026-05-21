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

export interface TemporalGraphServiceOptions {
  registry: EntityRegistryRepository
  relationships: RelationshipRepository
}

export type TimelineEventKind =
  | 'entity_registered'
  | 'alias_added'
  | 'relationship_started'
  | 'relationship_ended'

export interface TimelineEntry {
  at: Date
  kind: TimelineEventKind
  entityId: string
  detail: string
  edgeId: string | null
  relationship: AtcRelationshipKind | null
  counterpartId: string | null
}

export interface TimelinePage {
  entityId: string
  entries: TimelineEntry[]
  total: number
  limit: number
  cursor: string | null
  nextCursor: string | null
}

export interface HistoricalGraphResult {
  rootId: string
  asOf: Date
  nodes: AtcEntityNode[]
  edges: AtcRelationshipEdge[]
  truncated: boolean
}

// ── Cursor (offset-based, opaque base64url) ──────────────────────────────────

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url')
}
function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown }
    if (typeof parsed.offset === 'number' && Number.isInteger(parsed.offset)
        && parsed.offset >= 0 && parsed.offset <= 10_000) return parsed.offset
    return 0
  } catch { return 0 }
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * TemporalGraphService — append-only timeline reconstruction.
 *
 * Edges are NEVER deleted; `ended_at` marks closure. Historical traversal
 * accepts an `asOf` timestamp and includes only edges that were active at
 * that moment.
 */
export class TemporalGraphService {
  private readonly registry: EntityRegistryRepository
  private readonly relationships: RelationshipRepository

  constructor(opts: TemporalGraphServiceOptions) {
    this.registry = opts.registry
    this.relationships = opts.relationships
  }

  // ── Timeline (paginated, chronological) ─────────────────────────────────

  async getTimeline(
    entityId: string,
    options: {
      limit?: number
      cursor?: string | null
      since?: Date | null
      until?: Date | null
    } = {},
  ): Promise<TimelinePage> {
    const cap = Math.min(options.limit ?? CORRELATION_LIMITS.DEFAULT_LIMIT, CORRELATION_LIMITS.MAX_LIMIT)
    const cursor = options.cursor ?? null
    const offset = decodeCursor(cursor)

    if (!entityId) {
      return { entityId: '', entries: [], total: 0, limit: cap, cursor, nextCursor: null }
    }
    const root = await this.registry.findById(entityId)
    if (!root) {
      return { entityId, entries: [], total: 0, limit: cap, cursor, nextCursor: null }
    }

    const entries: TimelineEntry[] = []
    entries.push({
      at: root.createdAt,
      kind: 'entity_registered',
      entityId: root.id,
      detail: `${root.type} ${root.externalId} registered`,
      edgeId: null,
      relationship: null,
      counterpartId: null,
    })
    for (const alias of root.aliases) {
      entries.push({
        at: alias.createdAt,
        kind: 'alias_added',
        entityId: root.id,
        detail: `alias ${alias.kind}:${alias.value}`,
        edgeId: null,
        relationship: null,
        counterpartId: null,
      })
    }

    const page = await this.relationships.list({
      entityId,
      direction: 'both',
      includeEnded: true,
      limit: CORRELATION_LIMITS.MAX_LIMIT,
      offset: 0,
    })
    for (const e of page.items) {
      const counterpart = e.from.id === entityId ? e.to.id : e.from.id
      entries.push({
        at: e.observedAt,
        kind: 'relationship_started',
        entityId: root.id,
        detail: `${e.relationship} ↔ ${counterpart}`,
        edgeId: e.id,
        relationship: e.relationship,
        counterpartId: counterpart,
      })
      if (e.endedAt) {
        entries.push({
          at: e.endedAt,
          kind: 'relationship_ended',
          entityId: root.id,
          detail: `${e.relationship} ↔ ${counterpart} ended`,
          edgeId: e.id,
          relationship: e.relationship,
          counterpartId: counterpart,
        })
      }
    }

    const filtered = entries.filter((e) => {
      if (options.since && e.at < options.since) return false
      if (options.until && e.at > options.until) return false
      return true
    }).sort((a, b) => a.at.getTime() - b.at.getTime())

    const sliced = filtered.slice(offset, offset + cap)
    const total = filtered.length
    const next = offset + sliced.length < total ? encodeCursor(offset + sliced.length) : null

    return { entityId, entries: sliced, total, limit: cap, cursor, nextCursor: next }
  }

  // ── Historical graph (asOf snapshot) ────────────────────────────────────

  async getHistoricalGraph(
    entityId: string,
    asOf: Date,
    depth = 1,
  ): Promise<HistoricalGraphResult> {
    const d = Math.max(1, Math.min(depth, CORRELATION_LIMITS.MAX_DEPTH))
    if (!entityId) {
      return { rootId: '', asOf, nodes: [], edges: [], truncated: false }
    }
    const root = await this.registry.findById(entityId)
    if (!root) {
      return { rootId: entityId, asOf, nodes: [], edges: [], truncated: false }
    }

    const nodes = new Map<string, AtcEntityNode>([[root.id, root]])
    const edges = new Map<string, AtcRelationshipEdge>()
    let frontier: string[] = [root.id]
    let truncated = false

    for (let i = 0; i < d; i++) {
      if (frontier.length === 0) break
      const batch = await this.relationships.listForEntities(frontier, {
        includeEnded: true,
        maxFanOutPerNode: CORRELATION_LIMITS.MAX_BREADTH_PER_NODE,
      })

      // Only edges that were active at asOf — observedAt <= asOf < (endedAt ?? +inf)
      const activeAtTime = batch.filter((e) => {
        if (e.observedAt > asOf) return false
        if (e.endedAt && e.endedAt <= asOf) return false
        return true
      })

      const frontierSet = new Set(frontier)
      const newIds = new Set<string>()
      for (const e of activeAtTime) {
        if (!edges.has(e.id)) edges.set(e.id, e)
        const discover = frontierSet.has(e.from.id) ? e.to.id : e.from.id
        if (!nodes.has(discover)) newIds.add(discover)
      }
      const newList = Array.from(newIds)
      const hydrated = await Promise.all(newList.map((id) => this.registry.findById(id)))
      for (let j = 0; j < newList.length; j++) {
        const n = hydrated[j]
        if (n) nodes.set(newList[j]!, n)
      }
      if (nodes.size >= CORRELATION_LIMITS.MAX_NODES) {
        truncated = true
        break
      }
      frontier = newList
    }

    return {
      rootId: root.id,
      asOf,
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      truncated,
    }
  }
}
