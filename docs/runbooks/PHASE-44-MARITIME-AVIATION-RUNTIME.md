# Phase 44 — Maritime, Aviation & Airspace Runtime

## Overview

Server-authoritative transport system for tracking vessels, aircraft, flights, airspace zones, and docking operations. Flight lifecycle transitions use `SELECT FOR UPDATE`; `flight_nonce` and `docking_nonce` UNIQUE constraints enforce idempotency at the DB layer.

## Package

`@atc/transport-runtime` — `/packages/transport-runtime`

## DB Tables

| Table | Purpose |
|---|---|
| `atc_vessels` | Vessel records with status and real-time position |
| `atc_aircraft` | Aircraft records with status and real-time position |
| `atc_flight_runtime` | Flight records with lifecycle status and nonce idempotency |
| `atc_airspace_zones` | Airspace zone definitions with altitude bands and status |
| `atc_docking_runtime` | Docking event records with nonce idempotency |
| `atc_transport_audit` | Append-only transport audit log |

## Migrations

145–150 (`packages/db/migrations/145_create_vessels.sql` through `150_create_transport_audit.sql`)

## API Endpoints

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/v1/transport/vessels` | `transport:write` | Register or update a vessel |
| GET | `/api/v1/transport/vessels` | `transport:read` | List all vessels |
| POST | `/api/v1/transport/vessels/position` | `transport:write` | Update vessel position |
| POST | `/api/v1/transport/vessels/dock` | `transport:write` | Dock a vessel |
| POST | `/api/v1/transport/vessels/undock` | `transport:write` | Undock a vessel |
| POST | `/api/v1/transport/aircraft` | `transport:write` | Register or update aircraft |
| POST | `/api/v1/transport/flights` | `transport:write` | Create a flight plan |
| GET | `/api/v1/transport/flights` | `transport:read` | List active flights |
| POST | `/api/v1/transport/flights/:flightId/depart` | `transport:write` | Mark flight as airborne |
| POST | `/api/v1/transport/flights/:flightId/land` | `transport:write` | Mark flight as landed |
| POST | `/api/v1/transport/flights/:flightId/divert` | `transport:write` | Mark flight as diverted |
| POST | `/api/v1/transport/airspace` | `transport:write` | Register airspace zone |
| GET | `/api/v1/transport/airspace` | `transport:read` | List airspace zones |
| POST | `/api/v1/transport/airspace/:zoneId/status` | `transport:write` | Update airspace zone status |

## EventBus Events Emitted

| Event | Payload | When |
|---|---|---|
| `atc:transport:vessel:registered` | `{ vesselId }` | After vessel registration |
| `atc:transport:vessel:position_updated` | `{ vesselId }` | After position update |
| `atc:transport:vessel:docked` | `{ vesselId, dockZoneId }` | After docking |
| `atc:transport:vessel:undocked` | `{ vesselId }` | After undocking |
| `atc:transport:aircraft:registered` | `{ aircraftId }` | After aircraft registration |
| `atc:transport:flight:created` | `{ flightId }` | After flight creation |
| `atc:transport:flight:departed` | `{ flightId }` | After departure |
| `atc:transport:flight:landed` | `{ flightId }` | After landing |
| `atc:transport:flight:diverted` | `{ flightId }` | After diversion |
| `atc:transport:airspace:zone_registered` | `{ zoneId }` | After zone registration |
| `atc:transport:airspace:restricted` | `{ zoneId }` | After restriction |
| `atc:transport:airspace:opened` | `{ zoneId }` | After opening |

## FiveM SDK

`ATC.Transport.RegisterVessel(params, cb)` — register vessel  
`ATC.Transport.ListVessels(cb)` — list vessels  
`ATC.Transport.UpdateVesselPosition(params, cb)` — update position  
`ATC.Transport.DockVessel(params, cb)` — dock vessel  
`ATC.Transport.UndockVessel(dockingId, cb)` — undock vessel  
`ATC.Transport.RegisterAircraft(params, cb)` — register aircraft  
`ATC.Transport.CreateFlight(params, cb)` — create flight  
`ATC.Transport.ListActiveFlights(cb)` — list active flights  
`ATC.Transport.DepartFlight(flightId, cb)` — depart  
`ATC.Transport.LandFlight(flightId, cb)` — land  
`ATC.Transport.DivertFlight(flightId, cb)` — divert  
`ATC.Transport.RegisterAirspaceZone(params, cb)` — register zone  
`ATC.Transport.ListAirspaceZones(cb)` — list zones  
`ATC.Transport.RestrictAirspace(zoneId, cb)` — restrict zone  
`ATC.Transport.OpenAirspace(zoneId, cb)` — open zone

## Concurrency Model

- `FlightRuntimeRepository.transition()` uses `SELECT FOR UPDATE` inside a transaction — prevents concurrent lifecycle transitions.
- `DockingRuntimeRepository.updateStatus()` uses `SELECT FOR UPDATE` to prevent double-undocking.
- `AirspaceZoneRepository.updateStatus()` uses `SELECT FOR UPDATE` for zone restriction/opening.
- `VesselRepository.updateStatus()` uses `SELECT FOR UPDATE` for vessel state changes.
- `flight_nonce` UNIQUE constraint: `ER_DUP_ENTRY` → `DuplicateFlightNonceError`.
- `docking_nonce` UNIQUE constraint: `ER_DUP_ENTRY` → `DuplicateDockingNonceError`.

## Ops Checklist

- [ ] Run migrations 145–150 before deploying
- [ ] Ensure `transport:write` and `transport:read` capabilities are granted to the game server principal
- [ ] Register airspace zones at server startup for discovery
- [ ] Monitor for stale `airborne` flights with no landing confirmation
- [ ] `atc_transport_audit` is append-only — no DELETE without audit retention policy review

## Error Reference

| Error | HTTP | Meaning |
|---|---|---|
| `VesselNotFoundError` | 404 | Vessel ID does not exist |
| `VesselAlreadyDockedError` | 422 | Vessel already docked |
| `AircraftNotFoundError` | 404 | Aircraft ID does not exist |
| `AircraftAlreadyAirborneError` | 422 | Aircraft already airborne |
| `FlightNotFoundError` | 404 | Flight ID does not exist |
| `DuplicateFlightNonceError` | 409 | Flight nonce already used |
| `AirspaceZoneNotFoundError` | 404 | Airspace zone ID does not exist |
| `DockingSlotNotFoundError` | 404 | Docking slot ID does not exist |
| `DuplicateDockingNonceError` | 409 | Docking nonce already used |
