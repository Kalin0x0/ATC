# Phase 74 — Unified Runtime API Gateway, Deterministic Access Mesh & Global Runtime Exposure

## Overview

Phase 74 establishes the unified API gateway layer for ATC's runtime infrastructure. It provides deterministic access mesh synchronization, distributed API routing configuration, runtime surface exposure management, and surface protection enforcement. All gateway records are idempotency-safe via nonces and support distributed multi-server deployments.

**Package:** `@atc/runtime-gateway`
**API prefix:** `/api/v1/runtime-gateway`
**Migrations:** 325–330

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `RuntimeGatewayService` | `runtimeGatewayService` | Manage API gateway lifecycle |
| `DeterministicAccessMeshService` | `deterministicAccessMeshService` | Sync and manage access mesh nodes |
| `DistributedApiRoutingService` | `distributedApiRoutingService` | Configure distributed API routing rules |
| `RuntimeExposureCoordinator` | `runtimeExposureCoordinator` | Coordinate runtime surface exposures |
| `RuntimeSurfaceProtectionService` | `runtimeSurfaceProtectionService` | Apply and manage surface protections |
| `GatewayRecoveryService` | `gatewayRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_runtime_gateway` | `gateway_id` | `suspended`, `failed`, `expired` |
| `atc_access_mesh` | `mesh_id` (UPSERT) | `desynchronized`, `offline` |
| `atc_gateway_routing` | `routing_id` (UPSERT) | `suspended`, `expired` |
| `atc_runtime_exposure` | `exposure_id` | `retracted`, `failed` |
| `atc_surface_protection` | `protection_id` | `breached`, `expired` |
| `atc_gateway_audit` | — (append-only) | never |

---

## State Machines

### RuntimeGateway
```
pending → active → suspended
                 → expired
                 → failed
```

### AccessMesh (UPSERT)
```
active → synchronized → desynchronized → (recover) → synchronized
       → degraded     → (recover) → synchronized
       → offline
```

### GatewayRouting (UPSERT)
```
active → routing → suspended
                 → expired
```

### RuntimeExposure
```
pending → exposing → exposed
                   → retracted
                   → failed
```

### SurfaceProtection
```
pending → active → breached
               → expired
```

---

## API Endpoints

### Runtime Gateway
- `POST /api/v1/runtime-gateway` — create gateway
- `POST /api/v1/runtime-gateway/:id/activate`
- `POST /api/v1/runtime-gateway/:id/suspend`
- `POST /api/v1/runtime-gateway/:id/expire`
- `POST /api/v1/runtime-gateway/:id/fail`
- `GET  /api/v1/runtime-gateway/:id`

### Access Mesh
- `POST /api/v1/runtime-gateway/mesh` — sync mesh (UPSERT by meshId)
- `POST /api/v1/runtime-gateway/mesh/:meshId/degrade`
- `POST /api/v1/runtime-gateway/mesh/:meshId/recover`
- `GET  /api/v1/runtime-gateway/mesh/:meshId`

### Gateway Routing
- `POST /api/v1/runtime-gateway/routing` — configure routing (UPSERT by routingId)
- `POST /api/v1/runtime-gateway/routing/:routingId/activate`
- `POST /api/v1/runtime-gateway/routing/:routingId/suspend`
- `GET  /api/v1/runtime-gateway/routing/:routingId`

### Runtime Exposure
- `POST /api/v1/runtime-gateway/exposure` — create exposure
- `POST /api/v1/runtime-gateway/exposure/:id/begin`
- `POST /api/v1/runtime-gateway/exposure/:id/complete`
- `POST /api/v1/runtime-gateway/exposure/:id/retract`
- `GET  /api/v1/runtime-gateway/exposure/:id`

### Surface Protection
- `POST /api/v1/runtime-gateway/protection` — create protection
- `POST /api/v1/runtime-gateway/protection/:id/activate`
- `POST /api/v1/runtime-gateway/protection/:id/breach`
- `POST /api/v1/runtime-gateway/protection/:id/expire`
- `GET  /api/v1/runtime-gateway/protection/:id`

### Cleanup
- `POST /api/v1/runtime-gateway/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/runtime_gateway.lua`.

| Event | Action |
|---|---|
| `atc:gateway:create` | Create runtime gateway |
| `atc:gateway:activate` | Activate gateway |
| `atc:gateway:suspend` | Suspend gateway |
| `atc:gateway:expire` | Expire gateway |
| `atc:gateway:fail` | Fail gateway |
| `atc:gateway:mesh:sync` | Sync access mesh |
| `atc:gateway:mesh:degrade` | Degrade mesh |
| `atc:gateway:mesh:recover` | Recover mesh |
| `atc:gateway:routing:configure` | Configure routing |
| `atc:gateway:routing:activate` | Activate routing |
| `atc:gateway:routing:suspend` | Suspend routing |
| `atc:gateway:exposure:create` | Create exposure |
| `atc:gateway:exposure:begin` | Begin exposing |
| `atc:gateway:exposure:complete` | Complete exposure |
| `atc:gateway:exposure:retract` | Retract exposure |
| `atc:gateway:protection:create` | Create protection |
| `atc:gateway:protection:activate` | Activate protection |
| `atc:gateway:protection:breach` | Breach protection |
| `atc:gateway:protection:expire` | Expire protection |
| `atc:gateway:cleanup` | Manual cleanup trigger |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## EventBus Signals

| Signal | Emitted by |
|---|---|
| `gateway_route_established` | `activateGateway`, `activateRouting`, `configureRouting` |
| `access_mesh_synchronized` | `syncMesh`, `recoverMesh` |
| `runtime_surface_secured` | `completeExposure`, `activateProtection` |

---

## Operational Checklist

- [ ] Verify migrations 325–330 applied: `SHOW TABLES LIKE 'atc_%'`
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test gateway round-trip: create → activate → GET
- [ ] Test mesh sync (UPSERT idempotency): sync twice with same meshId
- [ ] Test routing config: configure → activate routing
- [ ] Test exposure: create → begin → complete
- [ ] Test protection: create → activate
- [ ] Verify `breached` and `expired` protections are cleaned up
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup with low threshold
- [ ] Verify FiveM bridge events reach the API
