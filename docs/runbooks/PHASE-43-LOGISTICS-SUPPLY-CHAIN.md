# Phase 43 — Transportation, Logistics & Supply Chain Runtime

## Overview

Server-authoritative logistics system for tracking shipments, cargo, supply routes, fleets, and supply chain graph state. Shipment lifecycle transitions are protected by `SELECT FOR UPDATE`; nonce uniqueness enforces idempotency at the DB layer.

## Package

`@atc/logistics-runtime` — `/packages/logistics-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_shipments` | Shipment records with lifecycle status and cargo manifest |
| `atc_cargo_runtime` | Individual cargo items attached to shipments |
| `atc_supply_routes` | Registered trade routes with type/distance/ETA |
| `atc_logistics_fleets` | Fleet records with vehicle assignments and status |
| `atc_supply_chain_runtime` | Supply chain graph state (nodes + edges) |
| `atc_delivery_audit` | Append-only delivery audit log |

## Migrations

139–144 (`packages/db/migrations/139_create_shipments.sql` through `144_create_delivery_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/logistics/shipments` | `logistics:write` | Create a new shipment |
| GET | `/api/v1/logistics/shipments` | `logistics:read` | List active shipments |
| GET | `/api/v1/logistics/shipments/:shipmentId` | `logistics:read` | Get shipment details |
| POST | `/api/v1/logistics/shipments/:shipmentId/depart` | `logistics:write` | Mark shipment as in-transit |
| POST | `/api/v1/logistics/shipments/:shipmentId/deliver` | `logistics:write` | Mark shipment as delivered |
| POST | `/api/v1/logistics/shipments/:shipmentId/fail` | `logistics:write` | Mark shipment as failed |
| POST | `/api/v1/logistics/routes` | `logistics:write` | Register/update supply route |
| GET | `/api/v1/logistics/routes` | `logistics:read` | List active routes |
| POST | `/api/v1/logistics/fleets` | `logistics:write` | Register a fleet |
| POST | `/api/v1/logistics/fleets/:fleetId/assign` | `logistics:write` | Assign fleet to route |
| POST | `/api/v1/logistics/chains` | `logistics:write` | Upsert supply chain graph |
| POST | `/api/v1/logistics/chains/:chainId/disrupt` | `logistics:write` | Disrupt supply chain |
| POST | `/api/v1/logistics/chains/:chainId/restore` | `logistics:write` | Restore supply chain |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:logistics:shipment:created` | `{ shipmentId }` | After shipment creation |
| `atc:logistics:shipment:departed` | `{ shipmentId }` | After depart |
| `atc:logistics:shipment:delivered` | `{ shipmentId }` | After delivery |
| `atc:logistics:shipment:failed` | `{ shipmentId, reason }` | After failure |
| `atc:logistics:route:registered` | `{ routeId }` | After route registration |
| `atc:logistics:fleet:registered` | `{ fleetId }` | After fleet registration |
| `atc:logistics:fleet:assigned` | `{ fleetId, routeId }` | After fleet assignment |
| `atc:logistics:fleet:status_changed` | `{ fleetId, status }` | After status update |
| `atc:logistics:chain:upserted` | `{ chainId }` | After chain upsert |
| `atc:logistics:chain:disrupted` | `{ chainId }` | After chain disruption |
| `atc:logistics:chain:restored` | `{ chainId }` | After chain restoration |

## FiveM SDK

`ATC.Logistics.CreateShipment(params, cb)` — create shipment  
`ATC.Logistics.GetShipment(shipmentId, cb)` — get shipment  
`ATC.Logistics.ListActiveShipments(cb)` — list active shipments  
`ATC.Logistics.DepartShipment(shipmentId, cb)` — depart  
`ATC.Logistics.DeliverShipment(shipmentId, cb)` — deliver  
`ATC.Logistics.FailShipment(shipmentId, reason, cb)` — fail  
`ATC.Logistics.RegisterRoute(params, cb)` — register route  
`ATC.Logistics.ListActiveRoutes(cb)` — list routes  
`ATC.Logistics.RegisterFleet(params, cb)` — register fleet  
`ATC.Logistics.AssignFleet(fleetId, routeId, cb)` — assign fleet  
`ATC.Logistics.UpsertChain(params, cb)` — upsert supply chain  
`ATC.Logistics.DisruptChain(chainId, cb)` — disrupt chain  
`ATC.Logistics.RestoreChain(chainId, cb)` — restore chain

## Concurrency Model

- `ShipmentRepository.transition()` uses `SELECT FOR UPDATE` inside a transaction — prevents concurrent lifecycle transitions.
- `LogisticsFleetRepository.updateStatus()` uses `SELECT FOR UPDATE` to prevent double-deployment.
- `SupplyChainRepository.updateStatus()` uses `SELECT FOR UPDATE` for chain disruption/restore.
- `shipment_nonce` UNIQUE constraint: `ER_DUP_ENTRY` → `DuplicateShipmentNonceError`.

## Ops Checklist

- [ ] Run migrations 139–144 before deploying
- [ ] Ensure `logistics:write` and `logistics:read` capabilities are granted to the game server principal
- [ ] Register supply routes and chains at server startup for discovery
- [ ] Monitor for stale `in_transit` shipments with no delivery confirmation
- [ ] `atc_delivery_audit` is append-only — no DELETE without audit retention policy review
- [ ] `nodes`/`edges` in `atc_supply_chain_runtime` stored as JSON strings — validate before inserting large graphs

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `ShipmentNotFoundError` | 404 | Shipment ID does not exist |
| `ShipmentAlreadyInTransitError` | 422 | Shipment already in transit |
| `ShipmentAlreadyDeliveredError` | 422 | Shipment already delivered |
| `DuplicateShipmentNonceError` | 409 | Nonce already used |
| `SupplyRouteNotFoundError` | 404 | Route ID does not exist |
| `LogisticsFleetNotFoundError` | 404 | Fleet ID does not exist |
| `FleetAlreadyDeployedError` | 409 | Fleet already assigned and deployed |
| `SupplyChainNotFoundError` | 404 | Chain ID does not exist |
| `CargoNotFoundError` | 404 | Cargo item ID does not exist |
