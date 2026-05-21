import type {
  AtcEntityType,
  AtcEntitySearchResult,
  AtcEntitySearchHit,
} from '@atc/shared-types'
import type { EntityRegistryRepository } from './registry.repository.js'
import { offsetFromCursor, nextCursor } from './cursor.js'

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

function clamp(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

export interface EntitySearchServiceOptions {
  registry: EntityRegistryRepository
}

export interface SearchParams {
  query: string
  types?: AtcEntityType[]
  limit?: number
  cursor?: string | null
}

const SCORE_BY_MATCH: Record<AtcEntitySearchHit['matchedOn'], number> = {
  id:           1.00,
  external_id:  0.95,
  display_name: 0.80,
  alias:        0.70,
}

/**
 * EntitySearchService — indexed global search over the entity registry.
 *
 * The underlying SQL uses indexed UNION lookups (id / external_id /
 * display_name prefix / alias prefix) so all paths hit an index. Limits
 * are hard-capped at 100 and pagination is cursor-safe.
 */
export class EntitySearchService {
  constructor(private readonly opts: EntitySearchServiceOptions) {}

  async search(params: SearchParams): Promise<AtcEntitySearchResult> {
    const q = params.query.trim()
    const limit = clamp(params.limit)
    const cursor = params.cursor ?? null
    const offset = offsetFromCursor(cursor)
    const types = params.types ?? []

    if (!q) {
      return { query: q, types, hits: [], total: 0, limit, cursor, nextCursor: null }
    }

    const result = await this.opts.registry.search({
      query: q,
      ...(types.length > 0 ? { types } : {}),
      limit,
      offset,
    })
    const hits: AtcEntitySearchHit[] = result.hits.map((h) => ({
      entity: h.node,
      score: SCORE_BY_MATCH[h.matchedOn],
      matchedOn: h.matchedOn,
      matchedValue: h.matchedValue,
    }))

    return {
      query: q,
      types,
      hits,
      total: result.total,
      limit,
      cursor,
      nextCursor: nextCursor(offset, hits.length, result.total),
    }
  }
}
