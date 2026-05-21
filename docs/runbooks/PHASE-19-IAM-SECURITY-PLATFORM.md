# Phase 19 — IAM & Security Platform Runbook

## Overview

Phase 19 delivers the Identity, Authorization, Capability, and Security platform for ATC. It introduces deterministic RBAC with role inheritance, plugin trust-level isolation, an immutable audit trail, and five REST endpoints for runtime security operations.

---

## Packages Added

| Package | Purpose |
|---|---|
| `packages/iam` | RBAC engine, built-in roles, Redis-backed IAM cache |
| `packages/audit` | Append-only immutable audit trail (in-memory, bounded) |

---

## Architecture

### Authorization Engine (`AtcAuthorizationEngine`)

Deny-by-default. Evaluation order for `authorize()`:

1. **Principal explicit deny** → DENIED (highest priority, overrides everything)
2. **Role explicit deny** (any resolved role) → DENIED
3. **super_admin wildcard** → GRANTED
4. **Principal direct permission** → GRANTED
5. **Resolved role permission** (BFS with loop prevention) → GRANTED
6. **Default** → DENIED

For `authorizeCapability()`:

1. **Trust level enforcement** (plugin principals only) — capability must be in `IAM_TRUST_CAPABILITY_LIMITS[trustLevel]`, otherwise DENIED
2. **Principal direct capability** → GRANTED
3. **Resolved role capability** → GRANTED
4. **Default** → DENIED

### Role Hierarchy

```
super_admin
  └── admin
        ├── moderator
        │     └── support
        │           └── player (base)
        └── developer
              └── player (base)

plugin   (isolated — no inheritance, no default permissions)
service  (isolated — no inheritance)
```

### Plugin Trust Levels

| Trust Level | Allowed Capabilities |
|---|---|
| `internal` | All (full access) |
| `trusted` | All except `admin.write` |
| `untrusted` | `ops.read`, `cluster.read`, `telemetry.write`, `events.subscribe` |
| `restricted` | `telemetry.write` only |

Trust level enforcement is a **limiter**, not a granter. The principal must still hold the capability directly or via a role — the trust level only blocks capabilities outside the allowed list.

### Audit Service (`AtcAuditService`)

- In-memory, append-only ring buffer (default: 10,000 events)
- Each event is `Object.freeze()`-d immediately upon creation
- Oldest events are evicted when capacity is exceeded
- `getTotal()` tracks the lifetime count (includes evicted events)
- `size()` reports current in-memory count (≤ maxEvents)
- Filters: `actorId`, `action`, `result`; pagination via `limit`/`offset` (max 200/page)

---

## Built-In Roles

| Role ID | Key Permissions | Capabilities |
|---|---|---|
| `super_admin` | Everything (wildcard) | `admin.write`, `admin.read`, ops/cluster/plugin |
| `admin` | Player management, economy, inventory | `ops.read/write`, `cluster.read/write`, `plugin.reload` |
| `moderator` | Kick, ban, freeze, warn | `ops.read`, `cluster.read` |
| `developer` | God, noclip, admin read | `ops.read`, `cluster.read`, `ops.write` |
| `support` | Spectate, teleport | `ops.read` |
| `player` | `player.read` only | None |
| `plugin` | None | None (set by manifest/trust level) |
| `service` | `player.read` | `ops.read`, `cluster.read` |

---

## API Endpoints

All endpoints require `Authorization: Bearer <API_TOKEN>`.

### `GET /api/v1/security/roles`

Returns all built-in roles (id, name, description, permissions, capabilities, inherits).

**Response:**
```json
{ "total": 8, "roles": [ { "id": "super_admin", ... } ] }
```

### `GET /api/v1/security/principals`

Placeholder — returns an empty list. A production principal store would be wired here.

**Response:**
```json
{ "total": 0, "principals": [] }
```

### `GET /api/v1/security/audit`

Returns a paginated audit log. Returns empty if `auditService` is not configured.

**Query params:** `limit`, `offset`, `actorId`, `action`, `result`

**Response:**
```json
{ "events": [...], "total": 42, "offset": 0, "limit": 50 }
```

### `POST /api/v1/security/authorize`

Check whether a principal has a given permission.

**Body:**
```json
{
  "principalId": "u-1",
  "principalType": "account",
  "roles": ["admin"],
  "permissions": [],
  "capabilities": [],
  "denies": [],
  "permission": "player.ban"
}
```

**Response:** `AtcAuthorizationResult` — `{ authorized, reason, principalId, action, matchedRole?, denied? }`

Returns `503` if `authEngine` is not configured. Returns `400` for invalid body.

### `POST /api/v1/security/capabilities/check`

Check whether a principal has a given capability.

**Body:** Same as authorize, but `capability` instead of `permission`. Optional `trustLevel`.

**Response:** Same `AtcAuthorizationResult` shape.

---

## FiveM Security Bridge

Three read-only functions added to `ATC.Security` in `game/atc-core/server/security.lua`:

```lua
-- Fetch all built-in roles (async)
ATC.Security.GetRoles(function(ok, data, err) end)

-- Return cached role list (synchronous, may be nil)
ATC.Security.GetCachedRoles()

-- Check a capability (async, calls POST /api/v1/security/capabilities/check)
ATC.Security.CheckCapability(params, function(ok, result, err) end)

-- Fetch paginated audit log (async)
ATC.Security.GetAuditSummary({ limit=10, actorId='u-1' }, function(ok, page, err) end)
```

**No mutation from Lua.** All writes (role assignment, capability grants, ban decisions) go through the TS API only.

---

## Wiring `authEngine` and `auditService`

These are optional fields on `AppContext`. The security routes degrade gracefully (503/empty response) when not configured. To wire them:

```typescript
import { AtcAuthorizationEngine, BUILT_IN_ROLES } from '@atc/iam'
import { AtcAuditService } from '@atc/audit'

const authEngine = new AtcAuthorizationEngine(BUILT_IN_ROLES, { telemetry })
const auditService = new AtcAuditService({ maxEvents: 10_000, telemetry })

// Pass into AppContext
const ctx: AppContext = { ..., authEngine, auditService }
```

### IAM Cache

```typescript
import { AtcIamCache } from '@atc/iam'

const iamCache = new AtcIamCache(redis, { ttlSeconds: 300, telemetry })
// Use iamCache.getPrincipal/setPrincipal/invalidatePrincipal alongside the engine
```

---

## Telemetry Metrics

| Metric | Description |
|---|---|
| `security.auth_granted_total` | Permissions granted by the engine |
| `security.auth_denied_total` | Permissions denied by the engine |
| `security.capability_checks_total` | Total capability checks performed |
| `security.cache_hits_total` | IAM cache hits |
| `security.cache_misses_total` | IAM cache misses |
| `security.audit_events_total` | Audit events appended |

---

## Capability Registry Update

Phase 19 expanded `ATC_CAPABILITIES` from 13 to 20 entries:

**Added:** `tasks.enqueue`, `tasks.schedule`, `ops.read`, `ops.write`, `cluster.read`, `cluster.write`, `plugin.reload`

---

## Schema Input Limits

All security POST endpoints enforce the following limits (returns 400 on violation):

| Field | Limit |
|---|---|
| `principalId` | max 128 characters |
| `permission` / `capability` | max 256 / 128 characters |
| `roles`, `permissions`, `capabilities`, `denies` arrays | max 50 items each |
| Array item strings | max 256 characters each |
| Audit `actorId`, `action` filter params | max 128 / 256 characters |

---

## Tests

| File | Coverage |
|---|---|
| `packages/tests/src/iam-roles.test.ts` | BUILT_IN_ROLES structure, inheritance, isolation |
| `packages/tests/src/iam-engine.test.ts` | authorize(), authorizeCapability(), resolvePermissions(), isSuperAdmin(), trust levels |
| `packages/tests/src/iam-cache.test.ts` | getPrincipal/set/invalidate, cache hits/misses, fail-open, corrupt payload guard |
| `packages/tests/src/audit.test.ts` | append(), list(), eviction, immutability, telemetry |
| `packages/tests/src/security-hardening.test.ts` | Deny-by-default, explicit deny beats super_admin, role deny precedence, unknown role safety, cyclic role BFS, privilege escalation scenarios, cache structural guard, pagination determinism, telemetry exactness |
| `apps/api/src/server.test.ts` | All 5 security endpoints including invalid query params, oversized arrays, empty principalId |

**Post-hardening test counts:** 1,223 tests (@atc/tests) + 286 tests (@atc/api) = **1,509 total, all passing**.

---

## Security Invariants

- **Deny-by-default**: a principal with no roles/permissions/capabilities is denied everything
- **Explicit deny is highest priority**: overrides super_admin wildcard, role permissions, and direct grants
- **Role deny also beats super_admin**: any role in the resolved set can deny a permission before wildcard fires
- **Plugin trust level is a ceiling, not a grant**: limits what a plugin _can_ hold, but the capability must still come from a direct grant or role
- **Trust level only applies to plugin-type principals**: `account`, `service`, `system` principals bypass the trust level check — callers must not fabricate elevated service principals
- **Unknown role IDs are silently skipped**: BFS does `continue` on unknown roles, never throws
- **Cyclic role graphs are safe**: BFS visited set prevents infinite loops
- **No capability mutation from Lua**: all FiveM bridge functions are read-only
- **Audit events are immutable**: `Object.freeze()` prevents post-append mutation
- **Cache is fail-open, authorization is fail-closed**: Redis errors return null (miss), which the caller must treat as unauthorized unless they re-fetch from the authoritative source
- **Cache structural guard**: corrupt or schema-invalid cache entries are treated as misses (null returned, miss counter incremented)
- **Telemetry is engine-only**: the authorization engine is the canonical counter for `auth_granted_total`, `auth_denied_total`, `capability_checks_total` — route handlers do not duplicate these
- **super_admin only through role assignment**: no implicit admin access from metadata or client input

---

## Known Architectural Trade-offs

1. **`/authorize` and `/capabilities/check` accept caller-supplied principal details.** This is a policy-decision-point pattern — the caller must supply principal data from a trusted source (database, IAM store). If the API bearer token is compromised, an attacker could fabricate principal permissions. Mitigate by keeping the API token secret and network-restricted.

2. **Trust level enforcement does not apply to non-plugin principal types.** A `service` principal with claimed `admin.write` in capabilities would have it granted. The security boundary is the API token, not the principal type field.

3. **Audit trail is in-memory with bounded eviction.** For durable audit persistence, callers should also write to the event store or a database. The in-memory ring buffer is a hot cache / operational view, not the system of record.

4. **`sourceInstanceId` is not populated in API route audit records.** A future improvement is to pass the runtime node's instance ID from `AppContext` to audit entries for cross-node correlation.
