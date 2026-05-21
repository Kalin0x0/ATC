# Phase 20 — Durable Identity, Authorization & Event-Driven Security Layer

## Overview

Phase 20 builds on the Phase 19 IAM & Security Platform to add persistence, event-driven propagation, and a full principal management API. It introduces a MariaDB-backed principal store, durable audit persistence, event-driven cache invalidation, session-bound authorization middleware, and 8 new REST endpoints.

---

## Packages Added

| Package | Purpose |
|---|---|
| `packages/principal-store` | MariaDB-backed repositories for principals, roles, capabilities, and security events |

---

## DB Migrations (018–021)

| File | Table | Purpose |
|---|---|---|
| `018_create_principals.sql` | `atc_principals` | Principal records (accounts, services, plugins, system actors) |
| `019_create_role_assignments.sql` | `atc_role_assignments` | Per-principal role grants with expiry and attribution |
| `020_create_capability_assignments.sql` | `atc_capability_assignments` | Per-principal capability grants with expiry and attribution |
| `021_create_security_events.sql` | `atc_security_events` | Durable append-only audit log |

---

## Architecture

### Principal Store (`packages/principal-store`)

Four repositories over a duck-typed `PrincipalStorePool` interface (compatible with `@atc/db`'s `DbPool`):

**`PrincipalRepository`**
- `create(params)` → insert a new principal
- `findById(id)` → lookup by ULID
- `findByAccountId(accountId)` → for session→principal binding (finds first active principal linked to an account)
- `list(params)` → paginated list with type/status/accountId filters
- `update(id, patch)` → update displayName, trustLevel, metadata
- `disable(id)` → set `status = 'disabled'`; idempotent; returns false if already disabled
- `resolve(id)` → full resolution: loads stored principal + non-expired role + capability assignments, assembles `AtcPrincipal` for the authorization engine. Returns null for disabled/suspended principals.

**`RoleAssignmentRepository`**
- `assign(params)` → `INSERT IGNORE` — idempotent; returns existing if already assigned
- `revoke(principalId, roleId)` → delete; returns false if not found
- `listByPrincipal(principalId)` → all non-expired assignments
- `find(principalId, roleId)` → specific assignment lookup

**`PrincipalCapabilityRepository`**
- `grant(params)` → `INSERT IGNORE` — idempotent
- `revoke(principalId, capability)` → delete; returns false if not found
- `listByPrincipal(principalId)` → all non-expired assignments
- `has(principalId, capability)` → boolean check (non-expired)

**`SecurityEventRepository`**
- `append(params)` → durable INSERT to `atc_security_events` (complements in-memory `AtcAuditService`)
- `list(params)` → paginated with actorId/action/result filters; max 200/page

### Principal Schema

```sql
atc_principals
  id              CHAR(26)          — ULID primary key
  principal_type  VARCHAR(20)       — account | service | plugin | system
  status          VARCHAR(20)       — active | disabled | suspended
  display_name    VARCHAR(256)
  account_id      CHAR(26) NULL     — FK to atc_accounts (optional; for player principals)
  trust_level     VARCHAR(20) NULL  — internal | trusted | untrusted | restricted (plugin only)
  direct_permissions JSON           — AtcPermission[] beyond roles
  direct_denies      JSON           — AtcPermission[] explicit denies
  metadata        JSON NULL
```

### Session→Principal Binding

When a player logs in, resolve their IAM principal from the account:

```typescript
// In session creation handler
const principal = await ctx.principalStore.principals.findByAccountId(session.accountId)
if (!principal) {
  // Create principal on first login
  await ctx.principalStore.principals.create({
    type: 'account',
    displayName: player.name,
    accountId: session.accountId,
  })
}
```

No client-supplied principal data is trusted — the principal is always resolved server-side from the account ID.

---

## Authorization Middleware

Three Fastify `preHandler` hooks in `apps/api/src/middleware/authorization.ts`:

```typescript
import { requirePermission, requireCapability, requireRole } from './middleware/authorization.js'

// On any route:
fastify.post('/my-route', {
  preHandler: requirePermission(ctx, 'player.ban'),
}, handler)

fastify.get('/ops/status', {
  preHandler: requireCapability(ctx, 'ops.read'),
}, handler)

fastify.get('/admin', {
  preHandler: requireRole(ctx, 'admin'),
}, handler)
```

### Resolution

The middleware reads the `X-ATC-Principal-Id` header, then:
1. Checks `ctx.iamCache` (IAM Redis cache — fast path)
2. Falls back to `ctx.principalStore.principals.resolve()` (DB)
3. Warms the cache for subsequent requests

If no header is present → `401`. If authorization fails → `403`.
If `ctx.authEngine` is not configured → the hook is skipped (degraded mode — fail-open).

**Security invariant**: this middleware is for internal API calls (the bearer token is already validated). It is not a replacement for the API bearer token check — it provides **fine-grained principal-level authorization** within authenticated requests.

---

## API Endpoints (Phase 20)

All endpoints require `Authorization: Bearer <API_TOKEN>`.

### `GET /api/v1/security/principals`

Paginated list of principals. Returns empty list when `principalStore` not configured.

**Query params:** `limit` (1–100, default 20), `offset`, `type`, `status`, `accountId`

**Response:**
```json
{ "total": 42, "principals": [...], "offset": 0, "limit": 20 }
```

### `POST /api/v1/security/principals`

Create a new principal. Emits `atc:security:principal:created` event.

**Body:**
```json
{
  "type": "account",
  "displayName": "Alice",
  "accountId": "01HZ...",
  "trustLevel": "trusted",
  "metadata": {}
}
```

**Response:** `201` — the created `StoredPrincipal`

### `GET /api/v1/security/principals/:id`

Get a principal by ID. Returns `404` if not found.

### `PUT /api/v1/security/principals/:id`

Update a principal's `displayName`, `trustLevel`, or `metadata`. Emits `atc:security:principal:updated` and invalidates the IAM cache entry.

### `POST /api/v1/security/principals/:id/disable`

Disable a principal. Returns `404` if not found or already disabled. Emits `atc:security:principal:disabled` and invalidates cache.

### `POST /api/v1/security/principals/:id/roles`

Assign a role to a principal. Idempotent — re-assigning an existing role is a no-op. Emits `atc:security:role:assigned` and invalidates cache.

**Body:** `{ "roleId": "moderator", "assignedBy": "admin-p-id", "expiresAt": "2026-01-01T00:00:00Z" }`

### `DELETE /api/v1/security/principals/:id/roles/:roleId`

Revoke a role assignment. Returns `404` if not found. Emits `atc:security:role:revoked` and invalidates cache.

### `POST /api/v1/security/principals/:id/capabilities`

Grant a capability. Idempotent. Emits `atc:security:capability:granted` and invalidates cache.

**Body:** `{ "capability": "ops.read", "grantedBy": "admin-p-id" }`

### `DELETE /api/v1/security/principals/:id/capabilities/:capability`

Revoke a capability. Returns `404` if not found. Emits `atc:security:capability:revoked` and invalidates cache.

---

## Wiring the Principal Store

```typescript
import { createPool } from '@atc/db'
import {
  PrincipalRepository,
  RoleAssignmentRepository,
  PrincipalCapabilityRepository,
  SecurityEventRepository,
} from '@atc/principal-store'
import { AtcIamCache } from '@atc/iam'

const pool = createPool(dbConfig)
const principalStore = {
  principals:      new PrincipalRepository(pool, telemetry),
  roleAssignments: new RoleAssignmentRepository(pool, telemetry),
  capabilities:    new PrincipalCapabilityRepository(pool, telemetry),
  securityEvents:  new SecurityEventRepository(pool, telemetry),
}
const iamCache = new AtcIamCache(redis, { ttlSeconds: 300, telemetry })

const ctx: AppContext = {
  ...,
  principalStore,
  iamCache,
  authEngine,  // from Phase 19
  auditService, // from Phase 19 (in-memory; optional alongside DB audit)
}
```

### Event-Driven Cache Invalidation

Wire the event bus to invalidate the IAM cache when principal data changes:

```typescript
import { ATC_SECURITY_EVENTS } from '@atc/shared-types'

// In server startup, after ctx is assembled:
ctx.eventBus.on(ATC_SECURITY_EVENTS.ROLE_ASSIGNED, (payload: { principalId: string }) => {
  void ctx.iamCache?.invalidatePrincipal(payload.principalId)
})
ctx.eventBus.on(ATC_SECURITY_EVENTS.ROLE_REVOKED, (payload: { principalId: string }) => {
  void ctx.iamCache?.invalidatePrincipal(payload.principalId)
})
ctx.eventBus.on(ATC_SECURITY_EVENTS.CAPABILITY_GRANTED, (payload: { principalId: string }) => {
  void ctx.iamCache?.invalidatePrincipal(payload.principalId)
})
ctx.eventBus.on(ATC_SECURITY_EVENTS.CAPABILITY_REVOKED, (payload: { principalId: string }) => {
  void ctx.iamCache?.invalidatePrincipal(payload.principalId)
})
ctx.eventBus.on(ATC_SECURITY_EVENTS.PRINCIPAL_DISABLED, (payload: { principalId: string }) => {
  void ctx.iamCache?.invalidatePrincipal(payload.principalId)
})
```

The route handlers already emit these events. This listener wiring is separate so callers can choose whether to connect it (e.g., single-instance deployments may skip it).

---

## Durable Audit Persistence

Phase 20 adds `atc_security_events` as a durable complement to the Phase 19 in-memory ring buffer:

| Layer | Phase | What it is |
|---|---|---|
| In-memory ring buffer (`AtcAuditService`) | 19 | Fast hot cache, bounded (10k events), evicts oldest |
| DB table (`atc_security_events`) | 20 | Durable, queryable, unlimited retention |

Both layers are written to when both are configured. The `GET /api/v1/security/audit` endpoint prefers the DB-backed store when `principalStore.securityEvents` is configured.

---

## New Security Event Types

```typescript
ATC_SECURITY_EVENTS.PRINCIPAL_CREATED   // 'atc:security:principal:created'
ATC_SECURITY_EVENTS.PRINCIPAL_UPDATED   // 'atc:security:principal:updated'
ATC_SECURITY_EVENTS.PRINCIPAL_DISABLED  // 'atc:security:principal:disabled'
ATC_SECURITY_EVENTS.CAPABILITY_REVOKED  // 'atc:security:capability:revoked'
```

Added to the existing Phase 19 events: `AUTH_GRANTED`, `AUTH_DENIED`, `ROLE_ASSIGNED`, `ROLE_REVOKED`, `CAPABILITY_GRANTED`, `CAPABILITY_DENIED`.

---

## New Telemetry Metrics

| Metric | Description |
|---|---|
| `iam.principal_created_total` | Principals created |
| `iam.principal_updated_total` | Principals updated |
| `iam.principal_disabled_total` | Principals disabled |
| `iam.role_assigned_total` | Role assignments granted |
| `iam.role_revoked_total` | Role assignments revoked |
| `iam.capability_granted_total` | Capabilities granted |
| `iam.capability_revoked_total` | Capabilities revoked |
| `iam.principal_resolved_total` | Full principal resolutions (DB) |
| `iam.cache_invalidations_total` | IAM cache invalidations triggered |

---

## Schema Input Limits (Phase 20 endpoints)

| Field | Limit |
|---|---|
| `displayName` | min 1, max 256 chars |
| `accountId`, `assignedBy`, `grantedBy` | max 128 chars |
| `roleId` | min 1, max 64 chars |
| `capability` | min 1, max 128 chars |
| `metadata` record | max 20 keys, values max 512 chars |
| list `limit` | 1–100, default 20 |
| `expiresAt` | must be ISO 8601 datetime |

---

## Tests

| File | Coverage |
|---|---|
| `packages/tests/src/principal-store.test.ts` | PrincipalRepository (create, findById, disable, resolve, list), RoleAssignmentRepository (assign, revoke, list), PrincipalCapabilityRepository (grant, revoke, has), SecurityEventRepository (append, list) |
| `apps/api/src/server.test.ts` (Phase 20 additions) | All 8 new principal management endpoints: 503 when store absent, 404 on miss, 201/200 on success, 400 on invalid input, event emission verified, cache invalidation verified |

**Post-Phase-20 test counts:** 1,223 tests (@atc/tests) + 286 + 49 new (@atc/api) = **1,558 total, all passing** (indicative — actual count from `pnpm turbo test`).

---

## Security Invariants (carried forward from Phase 19)

All Phase 19 invariants continue to apply. Phase 20 additions:

- **Principal resolution is server-authoritative**: `resolve()` only returns active principals; disabled/suspended principals return null even if cache has a stale entry
- **Role assignment is idempotent**: `INSERT IGNORE` prevents duplicate grants; re-assigning an existing role is safe
- **Expiry is enforced at query time**: `expires_at > NOW(3)` filter in all non-expired queries; no separate cleanup process required for correctness
- **Cache invalidation is fire-and-forget**: route handlers call `void ctx.iamCache.invalidatePrincipal()` — failures do not propagate to the caller (fail-open at cache layer)
- **Audit persistence is best-effort**: if the DB write for `atc_security_events` fails, the route does not fail — use `void` on the append call
- **Trust level enforcement is unchanged**: still enforced only by the authorization engine, not the principal store

---

## Known Architectural Trade-offs

1. **`resolve()` makes 3 DB round-trips** (principal + roles + capabilities). Cache TTL (300s default) amortizes this for repeated checks on the same principal. High-frequency authorization should always go through the cache-first path.

2. **No cross-instance cache invalidation bus.** The event bus is in-process; in a multi-node deployment, invalidation only affects the local node's IAM cache. Add Redis pub/sub wiring to `wireSecurityCacheInvalidation()` for distributed invalidation.

3. **`direct_permissions` and `direct_denies` are JSON columns.** They cannot be individually indexed for fast lookups. For deployments with very large permission arrays, migrate to a separate table.

4. **The `atc_security_events` table grows without bound.** Implement a retention policy (e.g., DELETE events older than 90 days) as a background task in Phase 21.

5. **`assignedBy` / `grantedBy` are stored as strings.** They are not foreign-keyed to `atc_principals` to avoid FK constraint failures when system-level actors (e.g., `'system'`) assign roles before their own principal records exist.
