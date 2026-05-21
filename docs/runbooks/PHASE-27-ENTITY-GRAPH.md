# Phase 27 — Entity Registry & Cross-Reference Graph

**Owner:** Agent 2 (read/index side)
**Scope:** backend intelligence / indexing layer — **not gameplay**
**Surface:** read-only HTTP routes + SDK + indexing repositories

## Goals

Unify cross-domain entity references (characters, vehicles, incidents,
warrants, arrests, citations, BOLOs, evidence, organizations, accounts)
behind a single canonical directory and provide bounded relationship-graph
traversal for MDT-style intelligence dashboards.

This is a read model. No gameplay logic, no event emission, no mutable
state machines. Writes are restricted to the entity-graph tables themselves
(registration, alias, relationship records — index data only).

## Database Schema

Three append-safe, indexed migrations:

| File | Table | Purpose |
|------|-------|---------|
| `056_create_entity_registry.sql`     | `atc_entity_registry`      | canonical entity directory (type, external_id, display_name, source, visibility, metadata) |
| `057_create_entity_relationships.sql` | `atc_entity_relationships` | typed directional edges with observed/ended timestamps |
| `058_create_entity_aliases.sql`      | `atc_entity_aliases`       | alternate names, phones, plates, badges, VINs, tags |

All tables include CHECK constraints on enum-style columns and composite indexes optimized for graph traversal (`from_entity_id, relationship, observed_at`, `to_entity_id, relationship, observed_at`).

## Package `@atc/entity-graph`

```
packages/entity-graph/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                   — public exports
    ├── pool.ts                    — opaque mysql2 pool type
    ├── id.ts                      — ULID generator
    ├── cursor.ts                  — opaque base64url cursor encode/decode
    ├── errors.ts                  — typed errors
    ├── registry.repository.ts     — atc_entity_registry + atc_entity_aliases
    ├── relationship.repository.ts — atc_entity_relationships
    ├── registry.service.ts        — EntityRegistryService
    ├── graph.service.ts           — RelationshipGraphService (bounded BFS)
    ├── search.service.ts          — EntitySearchService
    └── sdk.ts                     — AtcEntityGraphSDK facade
```

### Services

| Service | Responsibility |
|---|---|
| `EntityRegistryService` | `register`, `addAlias`, `getById`, `getByTypeAndExternalId`, `list`, `listAliases` |
| `RelationshipGraphService` | `getRelationships`, `getRelated` (BFS), `getCrossReferences`, `getNeighbors`, `getHistory` |
| `EntitySearchService` | `search(query, types?, limit, cursor)` |

### Graph traversal limits (`ENTITY_GRAPH_LIMITS`)

| Limit | Value | Purpose |
|---|---|---|
| `MAX_TRAVERSAL_DEPTH`       | 4   | Hard cap on BFS depth; rejected at schema layer |
| `MAX_NODES_PER_TRAVERSAL`   | 200 | Stops runaway expansions (truncated flag returned) |
| `MAX_BREADTH_PER_NODE`      | 50  | Caps fan-out per node in `listForEntities` |
| `MAX_LIMIT`                 | 100 | Page-size cap on all `list*`/`search*` routes |

## API Routes

All routes require `Authorization: Bearer <apiToken>` plus capability:

| Route | Capability | Returns |
|---|---|---|
| `GET /api/v1/entities/search?q=...` | `dispatch.read` | `AtcEntitySearchResult` |
| `GET /api/v1/entities/:id`          | `dispatch.read` (+ `law.read` for `restricted` visibility) | `AtcEntityNode` |
| `GET /api/v1/entities/:id/relationships` | `dispatch.read` | `AtcEntityRelationshipPage` |
| `GET /api/v1/entities/:id/history`  | `dispatch.read` | `AtcEntityHistoryPage` |
| `GET /api/v1/entities/:id/related?depth=N` | `dispatch.read` | `AtcEntityRelatedGraph` |

Validation is via Zod schemas in `@atc/schemas` (`entitySearchQuerySchema`, `entityRelationshipsQuerySchema`, `entityRelatedQuerySchema`, `entityHistoryQuerySchema`, `entityIdParamSchema`). All search/listing endpoints support an opaque `cursor` parameter.

## SDK

```typescript
import { AtcEntityGraphSDK } from '@atc/entity-graph'

const sdk = new AtcEntityGraphSDK({
  registry: new EntityRegistryRepository(pool),
  relationships: new RelationshipRepository(pool),
})

await sdk.search({ query: 'Alice', types: ['character'] })
await sdk.getEntity(entityId)
await sdk.getRelationships({ entityId, direction: 'outbound' })
await sdk.getRelated({ entityId, depth: 2 })
await sdk.getHistory(entityId, 20)
await sdk.getCrossReferences(entityId)
await sdk.getNeighbors(entityId)
```

## MDT Integration (`@atc/mdt`)

`MdtIntelligenceService` wraps the entity-graph SDK and exposes MDT-friendly aggregations:

- `resolveCharacterEntity(characterId)` — char → canonical entity
- `getSubjectGraph(characterId, depth=2)` — root entity + graph + cross-refs + known associates
- `getLinkedEntities(characterId)` — depth-1 neighbors
- `getKnownAssociates(characterId)` — depth-1 filtered to identity-style edges

The aggregation is purely read-only; mutation paths are not exposed.

## Performance Protections

- **No N+1 queries.** All BFS expansions use a single `listForEntities` batched query.
- **Indexed lookups only.** Search uses a UNION of indexed columns (id, external_id, lowercase display_name prefix, lowercase alias prefix). The `atc_entity_aliases` table uses a generated `alias_value_lc` column for case-insensitive prefix matching with an index.
- **Hard caps.** Depth ≤ 4, breadth ≤ 50/node, total nodes ≤ 200, limit ≤ 100. Anything beyond is rejected at the schema layer (400) or truncated with a `truncated: true` flag.
- **Cursor-safe pagination.** Opaque base64url-encoded offsets. Decoder rejects out-of-range or non-integer values.
- **No recursive runaway.** BFS terminates on either depth, node-cap, or empty frontier.

## Security

- Every route is guarded by `requireCapability('dispatch.read')`.
- Entities with `visibility = 'restricted'` require additional `law.read` capability.
- Aliases are sanitized: control characters stripped, whitespace collapsed.
- Self-loops (`from = to`) are rejected at the repository layer.
- All input shapes are Zod-validated before reaching the service.
- Hidden / internal IDs (DB row PKs other than `id`) are never exposed in route responses.

## Testing

```
pnpm --filter @atc/tests run test -- entity-graph
```

Tests cover:
- cursor round-trip + garbage rejection
- alias sanitisation
- registry findById null-safety
- registry list rejecting invalid type
- registry register insert + replay (idempotency)
- relationship self-loop rejection
- relationship empty-entity short-circuit
- relationship deduplication in `listForEntities`
- graph traversal depth out-of-bounds rejection
- graph traversal cycle detection without infinite loop
- graph traversal missing root → empty graph
- graph traversal relationship filter
- cross-reference pairing
- history chronological ordering
- search empty-query short-circuit + score-by-match
- SDK surface — read-only methods only
- Zod schema validation for all routes

## Wiring (Production)

```typescript
import {
  EntityRegistryRepository,
  RelationshipRepository,
  AtcEntityGraphSDK,
} from '@atc/entity-graph'

const entityRegistryRepo = new EntityRegistryRepository(pool)
const relationshipRepo   = new RelationshipRepository(pool)
const entityGraphSdk     = new AtcEntityGraphSDK({
  registry: entityRegistryRepo,
  relationships: relationshipRepo,
})

ctx.entityGraphSdk = entityGraphSdk
```

## Risks & Follow-ups

- Search uses `LIKE 'q%'` prefix matching against an indexed lowercase generated column. Full-text infix search would require FULLTEXT indexes and is deferred to Phase 28+.
- The registry only indexes entities that other systems explicitly register; no background reconciler exists yet. A periodic ingestion task (Agent 1 task-runtime) is recommended to backfill.
- Subject-graph aggregation in MDT relies on entity rows already existing for characters, BOLOs, incidents, etc. Until Agent 1's writers emit registry-register hooks, the MDT layer will degrade soft (empty graph, not error).
- Edge `ended_at` is updated by `RelationshipRepository.endEdge`; there is no public API endpoint for this — relationship lifecycle is owned by Agent 1 writers.
