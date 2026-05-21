# PHASE-59 — Federation, Multi-Region & Inter-Cluster Runtime

## Overview

Phase 59 introduces the federation runtime layer: node registration, cross-region state synchronisation, inter-cluster routing, distributed ownership tracking, and regional consistency checks. All operations are server-authoritative and replay-safe via idempotency nonces.

## Package

`packages/federation-runtime` — `@atc/federation-runtime`

## Services

| Service | Responsibility |
|---|---|
| `FederationRuntimeService` | Node lifecycle (register/deregister) |
| `MultiRegionSyncService` | Region state upsert, deactivation |
| `InterclusterRoutingService` | Route create/complete/fail |
| `FederationOwnershipService` | Claim/transfer/release entity ownership |
| `RegionalConsistencyService` | Start/complete/fail consistency checks |
| `FederationRecoveryService` | Cleanup stale nodes, routes, checks |

## Database Tables

| Table | Key Columns |
|---|---|
| `atc_federation_nodes` | `node_id`, `node_type`, `status`, `node_nonce` (UNIQUE) |
| `atc_region_runtime` | `region_id` (UNIQUE KEY for upsert) |
| `atc_intercluster_routes` | `route_id`, `status`, `route_nonce` (UNIQUE) |
| `atc_federation_ownership` | `entity_id` (UNIQUE KEY for upsert) |
| `atc_regional_consistency` | `check_id`, `status`, `check_nonce` (UNIQUE) |
| `atc_federation_audit` | append-only event log |

## API Routes

```
POST /api/v1/federation/nodes/register
POST /api/v1/federation/nodes/:id/deregister
GET  /api/v1/federation/nodes/:id
GET  /api/v1/federation/nodes/active

POST /api/v1/federation/sync
GET  /api/v1/federation/regions/:regionId
POST /api/v1/federation/regions/:regionId/deactivate

POST /api/v1/federation/routes/create
POST /api/v1/federation/routes/:id/complete
POST /api/v1/federation/routes/:id/fail
GET  /api/v1/federation/routes/:id

POST /api/v1/federation/ownership/claim
POST /api/v1/federation/transfer
POST /api/v1/federation/ownership/:entityId/release
GET  /api/v1/federation/ownership/:entityId

POST /api/v1/federation/consistency/start
POST /api/v1/federation/consistency/:id/complete
POST /api/v1/federation/consistency/:id/fail
GET  /api/v1/federation/consistency/:id

POST /api/v1/federation/cleanup
```

## FiveM Bridge Events

| Event | Direction | Description |
|---|---|---|
| `atc:federation:node:register` | Server-only | Register a node |
| `atc:federation:node:deregister` | Server-only | Deregister a node |
| `atc:federation:region:sync` | Server-only | Sync region state |
| `atc:federation:region:deactivate` | Server-only | Deactivate region |
| `atc:federation:route:create` | Server-only | Create inter-cluster route |
| `atc:federation:route:complete` | Server-only | Complete route |
| `atc:federation:route:fail` | Server-only | Fail route |
| `atc:federation:ownership:claim` | Server-only | Claim entity ownership |
| `atc:federation:ownership:transfer` | Server-only | Transfer ownership to new cluster |
| `atc:federation:ownership:release` | Server-only | Release ownership |
| `atc:federation:consistency:start` | Server-only | Start consistency check |
| `atc:federation:consistency:complete` | Server-only | Complete check |
| `atc:federation:consistency:fail` | Server-only | Fail check |
| `atc:federation:cleanup` | Scheduler | Purge stale records |

## Migrations

- `0235_create_atc_federation_nodes.sql`
- `0236_create_atc_region_runtime.sql`
- `0237_create_atc_intercluster_routes.sql`
- `0238_create_atc_federation_ownership.sql`
- `0239_create_atc_regional_consistency.sql`
- `0240_create_atc_federation_audit.sql`

## Idempotency

Node registration, route creation, and consistency checks are protected by `node_nonce`, `route_nonce`, and `check_nonce` UNIQUE constraints respectively. Duplicate nonces return `DuplicateFederationNodeError` / `DuplicateInterclusterRouteError` / `DuplicateConsistencyCheckError`. Region and ownership records use `ON DUPLICATE KEY UPDATE` (upsert-safe).

## Cleanup

`POST /api/v1/federation/cleanup` with `{ thresholdMs: 300000 }` purges:
- Inactive nodes older than threshold
- Failed/completed routes older than threshold
- Failed/passed consistency checks older than threshold

Recommended scheduler interval: every 5 minutes.

## Deployment Checklist

- [ ] Run migrations 0235–0240
- [ ] Deploy `@atc/federation-runtime` package
- [ ] Set `atc_cluster_id` and `atc_server_id` convars on each FiveM server
- [ ] Verify `GET /api/v1/federation/nodes/active` returns registered nodes
- [ ] Verify ownership claim → transfer → release lifecycle
- [ ] Schedule cleanup job at 5-minute interval
