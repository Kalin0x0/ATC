# Phase 78 — Production Deployment Governance, Runtime Operations Hardening & Global Release Coordination

## Overview

Phase 78 governs the production deployment and release coordination layer of ATC. It manages release governance policies, production deployment coordination, release validation pipelines, distributed orchestration, and global release runtime. Records in this phase represent the operational governance of production releases and deployments.

**Package:** `@atc/release-governance-runtime`
**API prefix:** `/api/v1/release-governance`
**Migrations:** 349–354

---

## Architecture

### Services

| Service | Context field | Purpose |
|---|---|---|
| `ReleaseGovernanceService` | `releaseGovernanceService` | Orchestrate release governance lifecycle |
| `ProductionDeploymentCoordinator` | `productionDeploymentCoordinator` | Coordinate production deployments |
| `RuntimeReleaseValidationService` | `runtimeReleaseValidationService` | Run release validation pipelines |
| `DistributedReleaseOrchestrator` | `distributedReleaseOrchestrator` | Orchestrate distributed release operations |
| `GlobalDeploymentGovernanceService` | `globalDeploymentGovernanceService` | Manage global release runtime |
| `ReleaseRecoveryService` | `releaseRecoveryService` | Stale-record cleanup across all repos |

### Tables

| Table | Key column | Cleanup states |
|---|---|---|
| `atc_release_governance` | `governance_id` | `rejected`, `expired`, `failed` |
| `atc_production_deployment` | `deployment_id` (UPSERT) | `rolled_back`, `failed` |
| `atc_release_validation` | `validation_id` | `failed` |
| `atc_release_orchestration` | `orchestration_id` (UPSERT) | `failed` |
| `atc_global_release_runtime` | `release_id` | `reverted`, `failed` |
| `atc_release_audit` | — (append-only) | never |

---

## State Machines

### ReleaseGovernance
```
pending → active → approved
               → rejected
               → expired
               → failed
```

### ProductionDeployment (UPSERT)
```
pending → deploying → deployed
                   → rolled_back
                   → failed
```

### ReleaseValidation
```
pending → validating → passed
                    → failed
```

### ReleaseOrchestration (UPSERT)
```
pending → running → completed
                 → failed
```

### GlobalReleaseRuntime
```
pending → active → completed
               → reverted
               → failed
```

---

## API Endpoints

### Release Governance
- `POST /api/v1/release-governance` — initiate governance
- `POST /api/v1/release-governance/:id/start`
- `POST /api/v1/release-governance/:id/approve`
- `POST /api/v1/release-governance/:id/reject`
- `GET  /api/v1/release-governance/:id`

### Production Deployment
- `POST /api/v1/release-governance/deployment` — initiate deployment (UPSERT by deploymentId)
- `POST /api/v1/release-governance/deployment/:deploymentId/activate`
- `POST /api/v1/release-governance/deployment/:deploymentId/complete`
- `POST /api/v1/release-governance/deployment/:deploymentId/rollback`
- `GET  /api/v1/release-governance/deployment/:deploymentId`

### Release Validation
- `POST /api/v1/release-governance/validation` — create validation
- `POST /api/v1/release-governance/validation/:id/begin`
- `POST /api/v1/release-governance/validation/:id/pass`
- `POST /api/v1/release-governance/validation/:id/fail`
- `GET  /api/v1/release-governance/validation/:id`

### Release Orchestration
- `POST /api/v1/release-governance/orchestration` — initiate (UPSERT by orchestrationId)
- `POST /api/v1/release-governance/orchestration/:orchestrationId/run`
- `POST /api/v1/release-governance/orchestration/:orchestrationId/complete`
- `GET  /api/v1/release-governance/orchestration/:orchestrationId`

### Global Release
- `POST /api/v1/release-governance/global` — create global release
- `POST /api/v1/release-governance/global/:id/activate`
- `POST /api/v1/release-governance/global/:id/complete`
- `POST /api/v1/release-governance/global/:id/revert`
- `GET  /api/v1/release-governance/global/:id`

### Cleanup
- `POST /api/v1/release-governance/cleanup` — body: `{ "thresholdMs": 300000 }`

---

## FiveM Events

Events registered in `game/atc-core/server/release_governance.lua`.

| Event | Action |
|---|---|
| `atc:release:governance:initiate` | Initiate governance |
| `atc:release:governance:start` | Start governance |
| `atc:release:governance:approve` | Approve governance |
| `atc:release:governance:reject` | Reject governance |
| `atc:release:deployment:initiate` | Initiate deployment |
| `atc:release:deployment:activate` | Activate deployment |
| `atc:release:deployment:complete` | Complete deployment |
| `atc:release:deployment:rollback` | Rollback deployment |
| `atc:release:validation:create` | Create validation |
| `atc:release:validation:begin` | Begin validating |
| `atc:release:validation:pass` | Pass validation |
| `atc:release:validation:fail` | Fail validation |
| `atc:release:orchestration:initiate` | Initiate orchestration |
| `atc:release:orchestration:run` | Run orchestration |
| `atc:release:orchestration:complete` | Complete orchestration |
| `atc:release:global:create` | Create global release |
| `atc:release:global:activate` | Activate global release |
| `atc:release:global:complete` | Complete global release |
| `atc:release:global:revert` | Revert global release |

Scheduled cleanup fires automatically every 5 minutes via `CreateThread`.

---

## EventBus Signals

| Signal | Emitted by |
|---|---|
| `release_started` | `startGovernance` |
| `deployment_governed` | `activateDeployment` |
| `production_release_completed` | `completeDeployment`, `completeRelease` |

---

## Operational Checklist

- [ ] Verify migrations 349–354 applied
- [ ] Confirm all 6 context fields non-null at startup
- [ ] Test governance round-trip: initiate → start → approve
- [ ] Test deployment UPSERT idempotency: initiate twice with same deploymentId
- [ ] Test validation: create → begin → pass (`validatedAt` present)
- [ ] Test orchestration UPSERT: initiate → run → complete
- [ ] Test global release: create → activate → complete (`completedAt` present)
- [ ] Verify stale records cleaned up per entity
- [ ] Confirm audit entries on all state transitions
- [ ] Test cleanup with low threshold
- [ ] Verify FiveM bridge events reach the API
