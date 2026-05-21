# Phase 25 — Dispatch, Incident & MDT Foundation

## Summary

Establishes the backend operational dispatch layer: incident records, inbound dispatch calls, responder assignment lifecycle, BOLO records, dispatch event fanout, and a read-only MDT aggregation service. No UI, no police gameplay, no AI dispatch, no CAD frontend.

---

## Files Created

| File | Description |
|---|---|
| `packages/shared-types/src/dispatch.ts` | AtcIncident, AtcDispatchCall, AtcResponderAssignment, AtcBoloRecord, ATC_DISPATCH_EVENTS |
| `packages/shared-types/src/mdt.ts` | AtcMdtCharacterProfile, AtcMdtSituationSnapshot |
| `packages/db/migrations/047_create_dispatch_calls.sql` | atc_dispatch_calls with idempotency_key UNIQUE |
| `packages/db/migrations/048_create_incidents.sql` | atc_incidents with JSON arrays (notes, evidence_ids, arrest_ids, citation_ids) |
| `packages/db/migrations/049_create_responder_assignments.sql` | atc_responder_assignments with status check constraint |
| `packages/db/migrations/050_create_bolo_records.sql` | atc_bolo_records with severity + status check constraints |
| `packages/dispatch/` | New package: pool, id, errors, 4 repos, service, sdk, index |
| `packages/mdt/` | New package: MdtService aggregating law + dispatch repos |
| `apps/api/src/routes/dispatch.ts` | 15 routes: calls, incidents, responders, BOLOs, MDT |
| `game/atc-core/server/dispatch.lua` | FiveM bridge: CreateCall, CreateIncident, AssignResponder, UpdateResponderState, GetIncidents, GetBolos, CreateBolo |
| `packages/tests/src/dispatch.test.ts` | 20 unit tests |
| `docs/runbooks/PHASE-25-DISPATCH-INCIDENT-MDT.md` | This file |

---

## Files Modified

| File | Change |
|---|---|
| `packages/shared-types/src/index.ts` | Added dispatch + mdt exports |
| `packages/operations/src/schemas.ts` | Appended Phase 25 Zod schemas (11 schemas, 11 types) |
| `packages/operations/src/index.ts` | Exported Phase 25 schemas + types |
| `apps/api/src/context.ts` | Added dispatchService, dispatchCallRepo, incidentRepo, responderRepo, boloRepo, mdtService fields |
| `apps/api/src/server.ts` | Registered dispatchRoutes |
| `apps/api/package.json` | Added @atc/dispatch, @atc/mdt |
| `apps/api/tsconfig.json` | Added packages/dispatch, packages/mdt references |
| `packages/tests/package.json` | Added @atc/dispatch, @atc/mdt |

---

## Database Migrations

Run in order after Phase 24 migrations:

```sql
-- 047: dispatch calls (idempotent via UNIQUE idempotency_key)
-- 048: incidents (links to agencies, JSON arrays for IDs)
-- 049: responder_assignments (FK to incidents)
-- 050: bolo_records (FK to agencies, links warrants/characters/vehicles)
```

```bash
pnpm --filter @atc/db run migrate
```

---

## API Routes

| Method | Path | Capability |
|---|---|---|
| GET | `/api/v1/dispatch/calls` | dispatch.read |
| POST | `/api/v1/dispatch/calls` | dispatch.write |
| GET | `/api/v1/dispatch/calls/:id` | dispatch.read |
| POST | `/api/v1/dispatch/calls/:id/accept` | dispatch.manage |
| GET | `/api/v1/dispatch/incidents` | dispatch.read |
| POST | `/api/v1/dispatch/incidents` | dispatch.write |
| GET | `/api/v1/dispatch/incidents/:id` | dispatch.read |
| POST | `/api/v1/dispatch/incidents/:id/escalate` | dispatch.manage |
| POST | `/api/v1/dispatch/incidents/:id/resolve` | dispatch.manage |
| POST | `/api/v1/dispatch/incidents/:id/notes` | dispatch.write |
| POST | `/api/v1/dispatch/incidents/:id/responders` | responder.manage |
| PATCH | `/api/v1/dispatch/responders/:id/status` | responder.manage |
| GET | `/api/v1/dispatch/bolos` | dispatch.read |
| POST | `/api/v1/dispatch/bolos` | bolo.manage |
| GET | `/api/v1/dispatch/bolos/:id` | dispatch.read |
| POST | `/api/v1/dispatch/bolos/:id/expire` | bolo.manage |
| POST | `/api/v1/dispatch/bolos/:id/notes` | bolo.manage |
| GET | `/api/v1/mdt/character/:characterId` | dispatch.read |
| GET | `/api/v1/mdt/situation/:agencyId` | dispatch.read |

---

## Dispatch Events Emitted

| Event | Constant | Payload |
|---|---|---|
| `atc:dispatch:call:created` | `DISPATCH_CREATED` | `{ call }` |
| `atc:dispatch:call:accepted` | `DISPATCH_ACCEPTED` | `{ call }` |
| `atc:dispatch:incident:created` | `INCIDENT_CREATED` | `{ incident }` |
| `atc:dispatch:incident:escalated` | `INCIDENT_ESCALATED` | `{ incident }` |
| `atc:dispatch:incident:resolved` | `INCIDENT_RESOLVED` | `{ incident }` |
| `atc:dispatch:responder:assigned` | `RESPONDER_ASSIGNED` | `{ assignment }` |
| `atc:dispatch:responder:status_changed` | `RESPONDER_STATUS_CHANGED` | `{ assignment }` |
| `atc:dispatch:bolo:created` | `BOLO_CREATED` | `{ bolo }` |
| `atc:dispatch:bolo:expired` | `BOLO_EXPIRED` | `{ bolo }` |

---

## Incident Status Machine

```
open → active (escalate)
open → resolved (resolve)
active → resolved (resolve)
resolved → archived (archive)
```

Resolved and archived incidents are immutable.

---

## Responder Status Machine

```
assigned → enroute | on_scene | unavailable | cleared
enroute  → on_scene | unavailable | cleared
on_scene → unavailable | cleared
unavailable → cleared
cleared → (terminal)
```

Transitions enforced with `FOR UPDATE` row lock in `updateStatus`. Invalid transitions throw `ResponderAssignmentImmutableError`.

---

## Idempotency

Dispatch calls use a `idempotency_key` UNIQUE constraint. On `ER_DUP_ENTRY`, the repository replays the existing record via `findByIdempotencyKey`. This protects against duplicate calls from unstable game clients or network retries.

---

## MDT Aggregation Service

`MdtService` (in `@atc/mdt`) provides two read-only aggregations:

- **`getCharacterProfile(characterId)`** — active warrants, arrest history, citations, active jail, active BOLO, open incidents.
- **`getSituationSnapshot(agencyId)`** — open incidents, active BOLOs, active warrant count, jailed count.

The MDT service depends on `@atc/law` (warrants, arrests, citations, jail) and `@atc/dispatch` (incidents, BOLOs). All queries are parallelised via `Promise.all`.

---

## FiveM Bridge Functions

```lua
ATC.Dispatch.CreateCall(source, location, priority, description, idempotencyKey)
ATC.Dispatch.CreateIncident(agencyId, priority, title, createdByPrincipalId, callId, location)
ATC.Dispatch.AssignResponder(source, incidentId, agencyId)
ATC.Dispatch.UpdateResponderState(assignmentId, newStatus)
ATC.Dispatch.GetIncidents(agencyId)          -- returns { items, total, offset, limit }
ATC.Dispatch.GetBolos(agencyId)              -- returns { items, total, offset, limit }
ATC.Dispatch.CreateBolo(source, agencyId, severity, description, opts)
```

All source-based functions resolve `principalId` server-side via `ATC.Accounts.GetPrincipalId(source)`. No client value is trusted.

---

## Testing

```bash
pnpm --filter @atc/tests run test
```

20 tests covering:
- DispatchCallRepository: create, idempotency replay, immutability guard
- IncidentRepository: create, escalate, immutable transitions, note append
- ResponderAssignmentRepository: create, status transitions, invalid transition, cleared_at set
- BoloRepository: create, expire, immutability guard, null result
- DispatchService: event emission for all 6 service operations

---

## Wiring (Production)

The `DispatchService` and repos must be wired into `AppContext` in the production entrypoint (`apps/api/src/index.ts` or equivalent):

```typescript
import { DispatchCallRepository, IncidentRepository, ResponderAssignmentRepository, BoloRepository, DispatchService } from '@atc/dispatch'
import { MdtService } from '@atc/mdt'

const dispatchCallRepo = new DispatchCallRepository(pool)
const incidentRepo     = new IncidentRepository(pool)
const responderRepo    = new ResponderAssignmentRepository(pool)
const boloRepo         = new BoloRepository(pool)
const dispatchService  = new DispatchService({ calls: dispatchCallRepo, incidents: incidentRepo, responders: responderRepo, bolos: boloRepo, eventBus, telemetry })
const mdtService       = new MdtService({ warrants: lawWarrantRepo, arrests: lawArrestRepo, citations: lawCitationRepo, jail: lawJailRepo, incidents: incidentRepo, bolos: boloRepo })

// Inject into ctx
ctx.dispatchService = dispatchService
ctx.dispatchCallRepo = dispatchCallRepo
ctx.incidentRepo = incidentRepo
ctx.responderRepo = responderRepo
ctx.boloRepo = boloRepo
ctx.mdtService = mdtService
```

---

## Security Notes

- All dispatch state mutations go through the API server — no client state is trusted
- `responder.manage` capability required to assign or update responders
- `bolo.manage` capability required to create, expire, or annotate BOLOs
- `dispatch.manage` capability required to escalate/resolve incidents or accept calls
- Read endpoints require `dispatch.read` capability only

---

## Hardening (Phase 26+)

- Add BOLO auto-expiry via scheduled job (`@atc/jobs` worker watching `expires_at < NOW()`)
- Add incident archival sweep for resolved incidents > 30 days
- Add `atc_dispatch_audit` log for all incident status transitions
- Rate-limit `POST /api/v1/dispatch/calls` to prevent call flooding from compromised clients
- Add per-agency active responder count caching in Redis for dashboard rendering

---

## MDT Aggregation Layer (Agent 2 — Phase 25 Read Model)

The MDT package (`@atc/mdt`) has been extended into a dedicated **read-only operational intelligence layer**. It aggregates law, dispatch, and evidence state into unified responses for use by responding officers, investigators, and operations dashboards.

### Strict Invariants

- **Read-only.** No SQL outside `SELECT`. No service-layer mutations.
- **No event emission.** The aggregation service does not depend on the event bus.
- **Capability-guarded routes.** All HTTP endpoints require `dispatch.read` or `law.read`.
- **No client trust.** Identity/agency comes from the resolved `AtcPrincipal`, not request body.
- **Cursor-safe pagination.** Opaque base64url-encoded offset cursors, hard-capped limits (max 100).
- **No N+1.** Related fetches are batched via `Promise.all`.
- **Fail-soft.** Missing optional repositories (evidence, responders) degrade gracefully.

### Service Methods

| Method | Returns | Notes |
|---|---|---|
| `getCharacterProfile(id)` | `AtcMdtCharacterProfile` | warrants + arrests + citations + jail + active BOLO |
| `getIncidentSummary(id)` | `AtcMdtIncidentSummary \| null` | incident + responders (active count derived) |
| `getActiveWarrants(id)` | `AtcMdtWarrantSummary` | includes highest-severity rollup |
| `getEvidenceSummary(id)` | `AtcMdtEvidenceSummary` | character → arrest → case (planned) |
| `getJailState(id)` | `AtcMdtJailState` | current active jail record only |
| `searchCharacters(q, opts)` | `AtcMdtSearchResult<AtcMdtCharacterProfile>` | exact-id match (fuzzy in Phase 26+) |
| `searchIncidents(q, opts)` | `AtcMdtSearchResult<AtcIncident>` | id match → agency fallback |
| `searchBolos(q, opts)` | `AtcMdtSearchResult<AtcBoloRecord>` | id match → linkedCharacterId fallback |
| `searchVehicles(q, opts)` | `AtcMdtSearchResult<AtcBoloRecord>` | filters active BOLOs by `linkedVehicleId` |

### Read-Only API Routes

| Method & Path | Capability |
|---|---|
| `GET /api/v1/mdt/characters/:id` | `dispatch.read` |
| `GET /api/v1/mdt/incidents/:id` | `dispatch.read` |
| `GET /api/v1/mdt/search/characters?q=...` | `law.read` |
| `GET /api/v1/mdt/search/incidents?q=...` | `dispatch.read` |
| `GET /api/v1/mdt/search/bolos?q=...` | `dispatch.read` |
| `GET /api/v1/mdt/search/vehicles?q=...` | `dispatch.read` |

All search routes accept `q` (required), `limit` (1–100, default 20), and an opaque `cursor` query parameter. Validation is via Zod schemas (`mdtSearchQuerySchema`, `mdtCharacterParamSchema`, `mdtIncidentParamSchema`, `mdtPaginationSchema`) exported from `@atc/schemas`.

### Capabilities Used

The MDT layer **does not introduce new capabilities**. It reuses:

- `dispatch.read` — operational visibility (incidents, BOLOs, vehicles)
- `law.read` — character profile and search (warrants, arrests, citations, jail)
- `evidence.manage` — required to fetch evidence summaries (read access only)
- `organization.manage` — required to fetch organization-scoped aggregations (read access only)

### SDK

`AtcMdtSDK` in `@atc/mdt` exposes the same methods as the service for in-process consumers (admin panel, FiveM bridge, internal tools):

```typescript
import { AtcMdtSDK } from '@atc/mdt'

const sdk = new AtcMdtSDK({
  warrants:   lawWarrantRepo,
  arrests:    lawArrestRepo,
  citations:  lawCitationRepo,
  jail:       lawJailRepo,
  evidence:   lawEvidenceRepo,    // optional
  incidents:  incidentRepo,
  bolos:      boloRepo,
  responders: responderRepo,      // optional
})

const profile = await sdk.getCharacterProfile('c-123')
const search  = await sdk.searchIncidents('agency-1', { limit: 25 })
```

### Performance Protections

- All `list()` calls forward `limit` and `offset` to the underlying repositories, which use indexed columns (`character_id`, `agency_id`, `status`, `linked_character_id`).
- The hard maximum result page is **100 items**; oversized requests are rejected at the schema layer with 400.
- The opaque cursor format encodes an integer offset only; decode rejects any out-of-range or non-numeric value, preventing offset injection.
- `searchVehicles` filters in memory but only after a capped `bolos.list({ limit: 100 })` call — total cost bounded.

### Wiring

To enable the new methods at runtime, construct the aggregation service with the extra repositories:

```typescript
import { MdtAggregationService } from '@atc/mdt'

const mdtService = new MdtAggregationService({
  warrants:   lawWarrantRepo,
  arrests:    lawArrestRepo,
  citations:  lawCitationRepo,
  jail:       lawJailRepo,
  evidence:   lawEvidenceRepo,
  incidents:  incidentRepo,
  bolos:      boloRepo,
  responders: responderRepo,
})
ctx.mdtService = mdtService
```

`MdtAggregationService` is exported as both its canonical name and the legacy `MdtService` alias for backward compatibility with existing wiring.

### Risks & Follow-ups

- `getEvidenceSummary` cannot resolve arrest → case without a join column on the arrests table (owned by Agent 1). Until then it returns an empty surface but reports correct character/case counts derived from arrests.
- `searchCharacters` performs exact-id lookup only; fuzzy/name search requires a `characters` text-index column (Agent 1).
- `openIncidents` in `getCharacterProfile` is empty by design — there is no character→incident join yet. Agent 1 may add a `atc_incident_subjects` table to enable this without changing the MDT contract.
- Vehicle search relies on the `linkedVehicleId` column on `atc_bolo_records`; a dedicated vehicle registry (Phase 26+) will replace this fallback.

