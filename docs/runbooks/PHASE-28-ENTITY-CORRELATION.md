# Phase 28 — Automatic Entity Correlation & Intelligence Producers

**Owner:** Agent 2 (read/index side)
**Scope:** event-driven indexing + analytics over the Phase 27 entity graph
**Surface:** read-only HTTP routes + SDK + projection helpers + event-bus ingestion

## Goals

Turn the static entity graph from Phase 27 into a self-building intelligence
graph. Domain events emitted by Agent 1 systems (law, dispatch, commerce,
jobs, medical) are projected into typed relationship edges with no impact
on source-system state machines.

This is an indexing/analytics layer. There is no gameplay logic, no
mutation of source systems, and no automatic punishment derived from
analytics output.

## Package `@atc/entity-correlation`

```
packages/entity-correlation/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── limits.ts
    ├── projection.service.ts   — event → edge projection (idempotent, fail-soft)
    ├── ingest.service.ts        — event-bus subscription wiring
    ├── correlation.service.ts   — known associates, clusters, risk
    ├── temporal.service.ts      — timeline + historical graph (asOf snapshots)
    └── sdk.ts                   — AtcEntityIntelligenceSDK facade
```

## Automatic Producers

| Domain event | Projected edge |
|---|---|
| `atc:law:warrant:created`         | character → warrant   (`character_subject_of_warrant`) |
| `atc:law:arrest:recorded`         | character → arrest    (`character_subject_of_arrest`) |
| `atc:law:citation:issued`         | character → citation  (`character_subject_of_citation`) |
| `atc:law:evidence:collected`      | incident → evidence   (`incident_links_evidence`) |
| `atc:dispatch:incident:created`   | caller character + agency org → incident |
| `atc:dispatch:responder:assigned` | responder character → incident (attribution=responder) |
| `atc:dispatch:responder:status_changed` (`status=cleared`) | ends the responder ↔ incident edge |
| `atc:commerce:receipt:created`    | organization → account |
| `atc:employment:contract_created` | character → organization (`character_member_of_organization`) |
| `atc:employment:contract_terminated` | ends the character ↔ organization edge |
| `atc:medical:treatment:applied`   | responder character ↔ patient character; patient → incident |

All projections are:
- **Idempotent** — duplicate active edges of the same kind between the same endpoints are suppressed.
- **Fail-soft** — exceptions inside the projection swallowed; the event bus reports zero failures.
- **Append-only history** — edges are never deleted. Relationship closure is modelled via `ended_at`.

## Services

| Service | Responsibility |
|---|---|
| `RelationshipProjectionService` | `project(input)` / `endProjection(input)` — register endpoints if missing, then create/close an edge. |
| `CorrelationIngestService` | Wires the AtcEventBus to the projection service; `start()` returns an `IngestSubscription`. |
| `EntityCorrelationService` | `getKnownAssociates`, `getCluster`, `computeRiskScore` |
| `TemporalGraphService` | `getTimeline` (paginated, since/until), `getHistoricalGraph` (asOf snapshot) |
| `AtcEntityIntelligenceSDK` | Facade combining correlation + temporal services |

### Risk score factors

`computeRiskScore` aggregates:

| Factor | Weight |
|---|---|
| warrantCount        | 0.30 |
| arrestCount         | 0.25 |
| incidentDensity     | 0.15 |
| knownAssociatesCount | 0.10 |
| citationCount       | 0.05 |
| relationshipFrequency | 0.02 |

Composite score clamped to `[0, 1]`.

## API Routes

All routes require `Authorization: Bearer <apiToken>` plus `dispatch.read`:

| Route | Returns |
|---|---|
| `GET /api/v1/entities/:id/timeline`        | `TimelinePage` (chronological, paginated, since/until filter) |
| `GET /api/v1/entities/:id/associates`      | `{ entityId, associates: AssociateResult[] }` |
| `GET /api/v1/entities/:id/risk`            | `RiskScoreResult` |
| `GET /api/v1/entities/:id/clusters`        | `ClusterResult` (bounded BFS, truncated flag) |
| `GET /api/v1/entities/:id/history/graph`   | `HistoricalGraphResult` (requires `asOf`, optional `depth`) |

Validation via Zod schemas in `@atc/schemas`:
`correlationTimelineQuerySchema`, `correlationAssociatesQuerySchema`,
`correlationHistoricalGraphQuerySchema`, plus the existing `entityIdParamSchema`.

## Performance Protections (`CORRELATION_LIMITS`)

| Limit | Value |
|---|---|
| MAX_DEPTH               | 4 |
| MAX_NODES               | 200 |
| MAX_BREADTH_PER_NODE    | 50 |
| MAX_LIMIT               | 100 |
| MAX_TIMELINE_WINDOW_DAYS | 365 |
| MAX_ASSOCIATES          | 100 |
| MAX_CLUSTER_SIZE        | 100 |

All BFS traversals use the batched `listForEntities` query (no N+1).
Cursor encoding is opaque base64url JSON `{offset:number}` with defensive
decoding that rejects out-of-range / non-integer values.

## Security

- Every route is `requireCapability('dispatch.read')`.
- Hidden / internal IDs (DB row PKs) are not exposed; responses only emit the public ULID surface defined in `@atc/shared-types`.
- Schema validation rejects malformed cursors, oversize limits, and depth > 4.
- Projection failures are swallowed — source-system event flow is never disturbed by an indexing error.
- The ingest service is strictly READ-ONLY over the event bus; it never emits events back into the bus.

## Wiring

```typescript
import {
  RelationshipProjectionService,
  CorrelationIngestService,
  AtcEntityIntelligenceSDK,
} from '@atc/entity-correlation'

const projection = new RelationshipProjectionService({
  registry: entityRegistryRepo,
  relationships: relationshipRepo,
  sourceSystem: 'entity-correlation',
})
new CorrelationIngestService({ projection, eventBus }).start()
ctx.entityIntelSdk = new AtcEntityIntelligenceSDK({
  registry: entityRegistryRepo,
  relationships: relationshipRepo,
})
```

## Testing

```
pnpm --filter @atc/tests run test -- entity-correlation
```

Covers: projection insert + duplicate suppression, fail-soft on registry
error, edge closure, ingest subscription counts, event field validation,
event-driven endProjection, unsubscribe cleanliness, no error propagation
to bus, associate filtering by relationship kind, empty/missing-root cases,
cluster bounds, risk factor decomposition, timeline ordering + since/until
filter + cursor advance, historical graph asOf inclusion/exclusion, SDK
read-only surface, schema cap enforcement.

## Risks & Follow-ups

- Producers depend on Agent 1 emitting these events with the expected payload fields. If the payload schema drifts, the projection silently no-ops. A schema-registry audit is recommended once Agent 1's event shapes stabilize.
- Risk score weights are heuristic; a follow-up phase should calibrate them against operational data.
- Cluster traversal cap is global — for high-degree investigative subjects, callers may need to chunk by relationship kind to surface specific communities.
- The ingest service is in-process only. Cross-node fan-out should use the existing Redis bridge (out of scope for this phase).
