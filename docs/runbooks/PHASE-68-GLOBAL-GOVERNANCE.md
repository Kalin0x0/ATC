# Phase 68 — Unified Runtime Governance, Global Coordination & Cross-System Arbitration

## Overview

Phase 68 introduces the global governance layer for ATC: cross-system directives, arbitration of resource conflicts, distributed consensus (Raft-style), policy management, and global ownership authority. All operations are backed by MariaDB, audited append-only, and emit events via the internal event bus.

**Package:** `@atc/global-governance-runtime`  
**API prefix:** `/api/v1/global-governance`  
**FiveM event namespace:** `atc:governance:*`

---

## Services

| Service | Responsibility |
|---|---|
| `GlobalGovernanceService` | Lifecycle of cross-system directives |
| `CrossSystemArbitrationService` | Conflict arbitration between subsystems |
| `RuntimeConsensusService` | Distributed consensus proposals and voting |
| `DistributedPolicyCoordinator` | Upsert, suspend, and revoke runtime policies |
| `GlobalOwnershipAuthority` | Claim, transfer, and release resource ownership |
| `GovernanceContinuityService` | Fan-out cleanup across all governance domains |

---

## Database Tables

| Table | Purpose |
|---|---|
| `atc_global_governance` | Directive records |
| `atc_crosssystem_arbitration` | Arbitration sessions |
| `atc_runtime_consensus` | Consensus proposals |
| `atc_global_policies` | Active policies (upsert-keyed by `policy_id`) |
| `atc_global_ownership` | Resource ownership (upsert-keyed by `resource_id`) |
| `atc_governance_continuity_audit` | Append-only audit log |

Migrations: `289_create_global_governance.sql` through `294_create_governance_continuity_audit.sql`

---

## API Endpoints

### Directives
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/global-governance/directive` | Create directive |
| POST | `/api/v1/global-governance/directive/:id/activate` | Activate |
| POST | `/api/v1/global-governance/directive/:id/resolve` | Resolve |
| POST | `/api/v1/global-governance/directive/:id/fail` | Fail |
| GET | `/api/v1/global-governance/directive/:id` | Fetch |

### Arbitration
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/global-governance/arbitration` | Start arbitration |
| POST | `/api/v1/global-governance/arbitration/:id/begin` | Begin arbitrating |
| POST | `/api/v1/global-governance/arbitration/:id/resolve` | Resolve |
| POST | `/api/v1/global-governance/arbitration/:id/reject` | Reject |
| GET | `/api/v1/global-governance/arbitration/:id` | Fetch |

### Consensus
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/global-governance/consensus` | Propose |
| POST | `/api/v1/global-governance/consensus/:id/vote` | Begin voting |
| POST | `/api/v1/global-governance/consensus/:id/commit` | Commit |
| POST | `/api/v1/global-governance/consensus/:id/abort` | Abort |
| GET | `/api/v1/global-governance/consensus/:id` | Fetch |

### Policy
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/global-governance/policy` | Upsert policy |
| POST | `/api/v1/global-governance/policy/:id/suspend` | Suspend |
| POST | `/api/v1/global-governance/policy/:id/revoke` | Revoke |
| GET | `/api/v1/global-governance/policy/:policyId` | Fetch by policyId |

### Ownership
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/global-governance/ownership` | Claim ownership |
| POST | `/api/v1/global-governance/ownership/:resourceId/release` | Release |
| GET | `/api/v1/global-governance/ownership/:resourceId` | Fetch |

### Cleanup
| Method | Path | Action |
|---|---|---|
| POST | `/api/v1/global-governance/cleanup` | Cleanup stale records |

---

## FiveM Events

```lua
-- Create directive
TriggerEvent('atc:governance:directive:create', { directiveType='mandate', ownerServerId='server-1', directiveNonce='nonce-1' }, cb)

-- Lifecycle
TriggerEvent('atc:governance:directive:activate', id, cb)
TriggerEvent('atc:governance:directive:resolve', id, cb)
TriggerEvent('atc:governance:directive:fail', id, cb)

-- Arbitration
TriggerEvent('atc:governance:arbitration:start', { arbitrationType='conflict', ownerServerId='server-1', arbitrationNonce='nonce-1' }, cb)
TriggerEvent('atc:governance:arbitration:resolve', id, cb)
TriggerEvent('atc:governance:arbitration:reject', id, cb)

-- Consensus
TriggerEvent('atc:governance:consensus:propose', { consensusType='raft', ownerServerId='server-1', consensusNonce='nonce-1' }, cb)
TriggerEvent('atc:governance:consensus:commit', id, cb)
TriggerEvent('atc:governance:consensus:abort', id, cb)

-- Policy
TriggerEvent('atc:governance:policy:upsert', { policyId='POL_001', policyType='resource', ownerServerId='server-1' }, cb)
TriggerEvent('atc:governance:policy:revoke', id, cb)

-- Ownership
TriggerEvent('atc:governance:ownership:claim', { resourceId='RES_001', ownershipType='exclusive', ownerServerId='server-1' }, cb)
TriggerEvent('atc:governance:ownership:release', resourceId, cb)

-- Scheduled cleanup fires automatically every 5 minutes
TriggerEvent('atc:governance:cleanup', 300000)
```

---

## Status Flows

**Directive:** `pending` → `active` → `resolved` / `failed`

**Arbitration:** `pending` → `arbitrating` → `resolved` / `rejected`

**Consensus:** `proposed` → `voting` → `committed` / `aborted`

**Policy:** `active` → `suspended` / `revoked`

**Ownership:** `claimed` → `transferred` (via transfer endpoint) / `released`

---

## Idempotency

Directives, arbitrations, and consensus records enforce `UNIQUE(nonce, owner_server_id)`. Duplicate nonce submissions return `DuplicateGovernanceError` (HTTP 409).

Policies are upserted keyed by `policy_id`. Ownership records are upserted keyed by `resource_id`.

---

## Cleanup

`GovernanceContinuityService.cleanupStale(thresholdMs)` fans out in `Promise.all` across all five repos. Returns `{ directives, arbitrations, consensuses, policies, ownerships }`.

Scheduled automatically in FiveM via `atc:governance:cleanup` every 5 minutes. Can be triggered manually via `POST /api/v1/global-governance/cleanup` with body `{ thresholdMs: number }`.

---

## Operational Notes

- All writes are audited to `atc_governance_continuity_audit` before emitting bus events.
- `updateStatus` uses `SELECT … FOR UPDATE` to prevent race conditions on status transitions.
- The `transfer` method on `GlobalOwnershipRepository` atomically moves ownership to a new `ownerServerId`.
- Policy and ownership upserts use `ON DUPLICATE KEY UPDATE` — safe to call repeatedly.
