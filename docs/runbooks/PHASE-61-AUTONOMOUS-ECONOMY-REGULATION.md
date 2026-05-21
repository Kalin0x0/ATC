# PHASE-61 — Autonomous Economy Regulation, Resource Balancing & Systemic Stabilization

## Overview

Phase 61 introduces the autonomous economy regulation runtime: rule-based regulations with expiry, autonomous resource balancing operations, per-region inflation tracking, dynamic tax adjustment, and market stabilization campaigns. All operations are server-authoritative.

## Package

`packages/economy-regulation-runtime` — `@atc/economy-regulation-runtime`

## Services

| Service | Responsibility |
|---|---|
| `EconomyRegulationService` | Create/suspend/list active regulations |
| `ResourceBalancingService` | Start/complete/fail balancing operations |
| `InflationControlService` | Upsert/get/deactivate per-region inflation |
| `AutonomousTaxAdjustmentService` | Upsert/get/suspend per-region tax rates |
| `MarketStabilizationService` | Start/complete/fail stabilization campaigns |
| `EconomicRecoveryService` | Cleanup stale regulations, balancings, stabilizations |

## Database Tables

| Table | Key Columns |
|---|---|
| `atc_economy_regulation` | `regulation_id`, `status`, `regulation_nonce` (UNIQUE) |
| `atc_resource_balancing` | `balancing_id`, `status`, `balancing_nonce` (UNIQUE) |
| `atc_market_stabilization` | `stabilization_id`, `status`, `stabilization_nonce` (UNIQUE) |
| `atc_tax_runtime` | `region_id` (UNIQUE KEY for upsert), `tax_rate` DECIMAL(10,4) |
| `atc_inflation_runtime` | `region_id` (UNIQUE KEY for upsert), `measured_at` refreshed on upsert |
| `atc_economy_audit` | append-only event log |

## API Routes

```
POST /api/v1/economy-regulation/regulations/create
POST /api/v1/economy-regulation/regulations/:id/suspend
GET  /api/v1/economy-regulation/regulations/:id
GET  /api/v1/economy-regulation/regulations/active

POST /api/v1/economy-regulation/balancing/start
POST /api/v1/economy-regulation/balancing/:id/complete
POST /api/v1/economy-regulation/balancing/:id/fail
GET  /api/v1/economy-regulation/balancing/:id

POST /api/v1/economy-regulation/inflation
GET  /api/v1/economy-regulation/inflation/:regionId

POST /api/v1/economy-regulation/tax
GET  /api/v1/economy-regulation/tax/:regionId

POST /api/v1/economy-regulation/stabilize
POST /api/v1/economy-regulation/stabilizations/:id/complete
POST /api/v1/economy-regulation/stabilizations/:id/fail
GET  /api/v1/economy-regulation/stabilizations/:id

POST /api/v1/economy-regulation/cleanup
```

## FiveM Bridge Events

| Event | Direction | Description |
|---|---|---|
| `atc:economy:regulation:create` | Server-only | Create a regulation rule |
| `atc:economy:regulation:suspend` | Server-only | Suspend active regulation |
| `atc:economy:balancing:start` | Server-only | Start resource balancing |
| `atc:economy:balancing:complete` | Server-only | Complete balancing |
| `atc:economy:balancing:fail` | Server-only | Fail balancing |
| `atc:economy:inflation:upsert` | Server-only | Set regional inflation rate |
| `atc:economy:tax:upsert` | Server-only | Set regional tax rate |
| `atc:economy:stabilize:start` | Server-only | Start market stabilization |
| `atc:economy:stabilization:complete` | Server-only | Complete stabilization |
| `atc:economy:stabilization:fail` | Server-only | Fail stabilization |
| `atc:economy:regulation:cleanup` | Scheduler | Purge stale records |

## Migrations

- `0247_create_atc_economy_regulation.sql`
- `0248_create_atc_resource_balancing.sql`
- `0249_create_atc_market_stabilization.sql`
- `0250_create_atc_tax_runtime.sql`
- `0251_create_atc_inflation_runtime.sql`
- `0252_create_atc_economy_audit.sql`

## Regulation Expiry

Regulations accept an optional `expiresAt` ISO 8601 datetime. The API route converts the string to a `Date` before persistence. Cleanup purges `status = 'expired'` and `expires_at < NOW()` records older than the threshold.

## Tax Rate Precision

Tax rates are stored as `DECIMAL(10,4)`. Valid range: 0.0000 to 1.0000. The Zod schema enforces `z.number().min(0).max(1)`. Always pass fractional rates (e.g. `0.2` for 20%).

## Inflation Measurement

Each upsert sets `measured_at = NOW(3)` on the DB side, ensuring the timestamp reflects when the rate was last observed rather than when the row was first created.

## Cleanup

`POST /api/v1/economy-regulation/cleanup` with `{ thresholdMs: 300000 }` purges:
- Suspended/expired regulations older than threshold
- Failed/completed balancings older than threshold
- Failed/completed stabilizations older than threshold

Recommended scheduler interval: every 5 minutes.

## Deployment Checklist

- [ ] Run migrations 0247–0252
- [ ] Deploy `@atc/economy-regulation-runtime` package
- [ ] Verify regulation create → suspend lifecycle
- [ ] Verify tax upsert idempotency (same regionId, different rates)
- [ ] Verify inflation `measured_at` refreshes on each upsert
- [ ] Verify balancing start → complete and start → fail paths
- [ ] Schedule cleanup job at 5-minute interval
