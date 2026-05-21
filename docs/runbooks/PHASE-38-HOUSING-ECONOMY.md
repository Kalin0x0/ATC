# Phase 38 — Housing Economy, Rentals & Asset Management

## Overview

Phase 38 introduces the `@atc/housing-economy` package, providing server-authoritative management of rental contracts, property taxes, asset valuations, foreclosures, and tenant payment history.

## Package: `@atc/housing-economy`

### Services

| Service | Responsibility |
|---|---|
| `HousingEconomyService` | Facade: contract creation, rent collection, foreclosure, tax assessment |
| `RentalContractService` | Contract lifecycle: create, renew, terminate, collect rent |
| `ForeclosureService` | Foreclosure lifecycle: start, complete, cancel |
| `PropertyTaxService` | Tax assessment, payment, overdue listing |
| `AssetValuationService` | Record valuations, fetch latest per property |
| `TenantManagementService` | Tenant history tracking |

### Repositories

| Repository | Table |
|---|---|
| `RentalContractRepository` | `atc_rental_contracts` |
| `HousingPaymentRepository` | `atc_housing_payments` |
| `PropertyTaxRepository` | `atc_property_taxes` |
| `AssetValuationRepository` | `atc_asset_valuations` |
| `ForeclosureRepository` | `atc_foreclosures` |
| `TenantHistoryRepository` | `atc_tenant_history` |

## API Endpoints

| Method | Path | Capability |
|---|---|---|
| `POST` | `/api/v1/housing/contracts` | `housing:write` |
| `GET` | `/api/v1/housing/contracts/:contractId` | `housing:read` |
| `POST` | `/api/v1/housing/contracts/:contractId/collect-rent` | `housing:write` |
| `POST` | `/api/v1/housing/contracts/:contractId/terminate` | `housing:write` |
| `POST` | `/api/v1/housing/taxes` | `housing:write` |
| `POST` | `/api/v1/housing/foreclosures` | `housing:write` |
| `POST` | `/api/v1/housing/foreclosures/:foreclosureId/complete` | `housing:write` |
| `POST` | `/api/v1/housing/valuations` | `housing:write` |
| `GET` | `/api/v1/housing/valuations/:propertyId/latest` | `housing:read` |
| `GET` | `/api/v1/housing/contracts/overdue` | `housing:read` |

## DB Migrations

- `109_create_rental_contracts.sql` — `atc_rental_contracts`, UNIQUE on `contract_nonce`
- `110_create_property_taxes.sql` — `atc_property_taxes`, UNIQUE on `(property_id, period_label)`
- `111_create_asset_valuations.sql` — `atc_asset_valuations`
- `112_create_foreclosures.sql` — `atc_foreclosures`, UNIQUE on `foreclosure_nonce`
- `113_create_tenant_history.sql` — `atc_tenant_history`
- `114_create_housing_payments.sql` — `atc_housing_payments`, UNIQUE on `idempotency_key`

## Events Emitted

| Event | Payload |
|---|---|
| `atc:housing:contract:created` | `contractId`, `propertyId`, `tenantPrincipalId`, `landlordPrincipalId`, `rentAmount` |
| `atc:housing:contract:terminated` | `contractId`, `propertyId`, `terminatedByPrincipalId`, `reason` |
| `atc:housing:contract:renewed` | `contractId`, `propertyId`, `newEndDate` |
| `atc:housing:rent:collected` | `paymentId`, `contractId`, `propertyId`, `fromPrincipalId`, `toPrincipalId`, `amount` |
| `atc:housing:foreclosure:started` | `foreclosureId`, `propertyId`, `initiatedByPrincipalId`, `reason` |
| `atc:housing:foreclosure:completed` | `foreclosureId`, `propertyId`, `completedAt` |
| `atc:housing:tax:assessed` | `taxId`, `propertyId`, `amount`, `periodLabel`, `dueAt` |
| `atc:housing:tax:paid` | `taxId`, `propertyId`, `paidByPrincipalId`, `amount` |
| `atc:housing:valuation:recorded` | `valuationId`, `propertyId`, `valuationAmount`, `method`, `valuedAt` |

## FiveM Bridge

`game/atc-core/server/housing.lua` exposes:

```lua
ATC.Housing.CreateContract(propertyId, tenantPrincipalId, landlordPrincipalId, monthlyRent, depositAmount, contractNonce, cb)
ATC.Housing.CollectRent(contractId, idempotencyKey, cb)
ATC.Housing.TerminateContract(contractId, terminatedBy, reason, cb)
ATC.Housing.AssessTax(propertyId, ownerPrincipalId, periodLabel, taxAmount, dueAt, cb)
ATC.Housing.StartForeclosure(propertyId, ownerPrincipalId, foreclosureNonce, reason, cb)
ATC.Housing.GetLatestValuation(propertyId, cb)
ATC.Housing.GetContract(contractId, cb)
```

## Concurrency & Idempotency

- Contract creation is idempotent via `contractNonce` — duplicate nonces return the existing contract
- Rent payment is idempotent via `idempotencyKey` — `UNIQUE KEY` on `atc_housing_payments.idempotency_key`
- Foreclosure creation uses `foreclosureNonce` to prevent duplicate triggers
- Property tax uses `UNIQUE KEY (property_id, period_label)` to prevent double-assessment

## Runbook: Common Operations

### Create a rental contract
```bash
curl -X POST http://api:3000/api/v1/housing/contracts \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":"prop-123","tenantPrincipalId":"p-tenant","landlordPrincipalId":"p-landlord","monthlyRent":"5000","depositAmount":"10000","contractNonce":"unique-nonce-1","startDate":"2026-06-01T00:00:00Z"}'
```

### Collect rent (idempotent)
```bash
curl -X POST http://api:3000/api/v1/housing/contracts/<contractId>/collect-rent \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"rent-<contractId>-2026-06"}'
```

### Start foreclosure
```bash
curl -X POST http://api:3000/api/v1/housing/foreclosures \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":"prop-123","ownerPrincipalId":"p-landlord","foreclosureNonce":"foreclosure-nonce-1","reason":"Non-payment of rent"}'
```
