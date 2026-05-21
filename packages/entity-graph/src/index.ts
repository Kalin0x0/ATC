// ── Pool & ids ────────────────────────────────────────────────────────────────
export type { EntityGraphPool } from './pool.js'
export { generateId } from './id.js'

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  EntityGraphError,
  EntityNotFoundError,
  InvalidEntityTypeError,
  InvalidTraversalDepthError,
} from './errors.js'

// ── Cursor utilities ──────────────────────────────────────────────────────────
export {
  encodeCursor,
  decodeCursor,
  offsetFromCursor,
  nextCursor,
  type CursorPayload,
} from './cursor.js'

// ── Repositories ──────────────────────────────────────────────────────────────
export {
  EntityRegistryRepository,
  sanitizeAlias,
  type RegisterEntityParams,
  type AddAliasParams,
  type ListEntitiesParams,
  type SearchEntitiesParams,
  type EntityPage,
} from './registry.repository.js'

export {
  RelationshipRepository,
  type RecordEdgeParams,
  type ListEdgesParams,
  type EdgePage,
} from './relationship.repository.js'

// ── Services ──────────────────────────────────────────────────────────────────
export {
  EntityRegistryService,
  type EntityRegistryServiceOptions,
} from './registry.service.js'

export {
  RelationshipGraphService,
  ENTITY_GRAPH_LIMITS,
  type RelationshipGraphServiceOptions,
  type GetRelationshipsParams,
  type GetRelatedParams,
} from './graph.service.js'

export {
  EntitySearchService,
  type EntitySearchServiceOptions,
  type SearchParams,
} from './search.service.js'

// ── SDK ───────────────────────────────────────────────────────────────────────
export {
  AtcEntityGraphSDK,
  type AtcEntityGraphSDKOptions,
} from './sdk.js'
