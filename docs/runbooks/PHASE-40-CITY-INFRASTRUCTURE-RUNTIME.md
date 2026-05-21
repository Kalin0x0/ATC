# Phase 40 — Persistent Infrastructure, Utilities & City Simulation

## Overview

Phase 40 introduces the `@atc/city-runtime` package, providing server-authoritative management of city infrastructure nodes, utility grids, traffic signals, environment state, and resource consumption.

## Package: `@atc/city-runtime`

### Services

| Service | Responsibility |
|---|---|
| `CityInfrastructureService` | Register nodes, report failures, update status |
| `InfrastructureRecoveryService` | Resolve failures, list active failures, clean stale |
| `TrafficSignalService` | Upsert signal state, list all |
| `EnvironmentRuntimeService` | Update environment per region, list all |
| `ResourceConsumptionService` | Record utility consumption, list by grid |
| `UtilityGridService` | Report outages (idempotent), restore grids |

### Repositories

| Repository | Table |
|---|---|
| `CityInfrastructureRepository` | `atc_city_infrastructure` |
| `InfrastructureFailureRepository` | `atc_infrastructure_failures` |
| `TrafficSignalRepository` | `atc_traffic_signals` |
| `EnvironmentRuntimeRepository` | `atc_environment_runtime` |
| `ResourceConsumptionRepository` | `atc_resource_consumption` |
| `UtilityGridRepository` | `atc_utility_grids` |

## API Endpoints

| Method | Path | Capability |
|---|---|---|
| `POST` | `/api/v1/city/infrastructure` | `city:write` |
| `GET` | `/api/v1/city/infrastructure/:nodeId` | `city:read` |
| `PATCH` | `/api/v1/city/infrastructure/:nodeId/health` | `city:write` |
| `GET` | `/api/v1/city/infrastructure/degraded` | `city:read` |
| `POST` | `/api/v1/city/failures` | `city:write` |
| `POST` | `/api/v1/city/failures/:failureId/resolve` | `city:write` |
| `GET` | `/api/v1/city/failures/active` | `city:read` |
| `POST` | `/api/v1/city/traffic-signals` | `city:write` |
| `GET` | `/api/v1/city/traffic-signals/:signalId` | `city:read` |
| `POST` | `/api/v1/city/environment` | `city:write` |
| `GET` | `/api/v1/city/environment/:regionId` | `city:read` |
| `POST` | `/api/v1/city/consumption` | `city:write` |
| `POST` | `/api/v1/city/utility-grids/outage` | `city:write` |
| `POST` | `/api/v1/city/utility-grids/:gridId/restore` | `city:write` |
| `GET` | `/api/v1/city/utility-grids/:gridId` | `city:read` |

## DB Migrations

- `121_create_city_infrastructure.sql` — `atc_city_infrastructure`, UNIQUE on `node_id`
- `122_create_utility_grids.sql` — `atc_utility_grids`, UNIQUE on `grid_id`
- `123_create_resource_consumption.sql` — `atc_resource_consumption`
- `124_create_traffic_signals.sql` — `atc_traffic_signals`, UNIQUE on `signal_id`
- `125_create_environment_runtime.sql` — `atc_environment_runtime`, UNIQUE on `zone_id`
- `126_create_infrastructure_failures.sql` — `atc_infrastructure_failures`, UNIQUE on `failure_nonce`

## Events Emitted

| Event | Payload |
|---|---|
| `atc:city:infrastructure_failure` | `failureId`, `nodeId`, `failureType`, `severity` |
| `atc:city:infrastructure_recovered` | `failureId`, `nodeId`, `recoveredByPrincipalId` |
| `atc:city:traffic_signal_changed` | `signalId`, `signalName`, `state`, `intersectionId` |
| `atc:city:environment_updated` | `regionId`, `weather`, `timeOfDay`, `isEmergencyWeather` |
| `atc:city:resource_consumed` | `gridId`, `resourceType`, `amount`, `consumerId` |
| `atc:city:utility_outage_started` | `gridId`, `gridName`, `utilityType`, `affectedZones`, `outageNonce` |
| `atc:city:utility_restored` | `gridId`, `gridName`, `utilityType`, `restoredByPrincipalId` |

## FiveM Bridge

`game/atc-core/server/city.lua` exposes:

```lua
ATC.City.RegisterInfrastructure(nodeId, nodeName, infrastructureType, cb)
ATC.City.GetInfrastructure(nodeId, cb)
ATC.City.ReportFailure(nodeId, failureType, severity, failureNonce, description, cb)
ATC.City.ResolveFailure(failureId, resolvedBy, cb)
ATC.City.ListActiveFailures(cb)
ATC.City.UpdateTrafficSignal(signalId, signalName, state, changedBy, cb)
ATC.City.GetTrafficSignal(signalId, cb)
ATC.City.UpdateEnvironment(regionId, params, cb)
ATC.City.GetEnvironment(regionId, cb)
ATC.City.RecordConsumption(gridId, resourceType, amount, consumerId, periodLabel, cb)
ATC.City.ReportUtilityOutage(gridId, gridName, utilityType, outageNonce, reason, affectedZones, cb)
ATC.City.RestoreUtilityGrid(gridId, restoredByPrincipalId, cb)
ATC.City.GetUtilityGrid(gridId, cb)
```

## Concurrency & Idempotency

- Infrastructure failures: `UNIQUE KEY` on `failure_nonce` — duplicate reports return the existing failure
- Utility outages: `findByOutageNonce` pre-check + `UNIQUE KEY` — duplicate nonces return existing grid
- Traffic signals: `ON DUPLICATE KEY UPDATE` upsert — safe to call repeatedly
- Environment: `INSERT ... ON DUPLICATE KEY UPDATE` upsert on `zone_id`

## Infrastructure Types

```
'power_station' | 'water_treatment' | 'gas_main' | 'telecom_hub'
'road_segment' | 'bridge' | 'tunnel' | 'sewage' | 'other'
```

## Failure Types

```
'power_outage' | 'water_leak' | 'gas_leak' | 'road_damage'
'bridge_failure' | 'telecom_outage' | 'other'
```

## Runbook: Reporting a Power Outage

```bash
# 1. Report the infrastructure failure (idempotent)
curl -X POST http://api:3000/api/v1/city/failures \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"nodeId":"power-station-pillbox","failureNonce":"fail-nonce-2026-05-20","failureType":"power_outage","severity":"critical","description":"Transformer explosion"}'

# 2. Report the utility grid outage (idempotent)
curl -X POST http://api:3000/api/v1/city/utility-grids/outage \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"gridId":"grid-ls-power","gridName":"LS Power Grid","utilityType":"power","outageNonce":"outage-2026-05-20","reason":"Transformer explosion","affectedZones":["zone-downtown","zone-pillbox"]}'

# 3. When resolved:
curl -X POST http://api:3000/api/v1/city/failures/<failureId>/resolve \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"failureId":"<failureId>","resolvedBy":"principal-engineer"}'

curl -X POST http://api:3000/api/v1/city/utility-grids/grid-ls-power/restore \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"restoredByPrincipalId":"principal-engineer"}'
```
