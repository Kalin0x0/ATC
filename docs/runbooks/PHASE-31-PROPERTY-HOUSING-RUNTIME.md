# Phase 31 Runbook — Persistent Property, Housing & World Storage Runtime

**Package:** `@atc/property-runtime`  
**Migrations:** 069–073  
**API routes:** 15  
**FiveM bridge:** `game/atc-core/server/property.lua`  
**Tests:** 30+ (in `packages/tests/src/property-runtime.test.ts`)

---

## State Machine

```
available ──purchase──► owned ──occupy──► occupied
    ▲                     │  ▲               │
    │                     │  └──── exit ─────┘
    │                   lock                 │
    │                     ▼                 lock
    │                   locked ◄─────────────┘
    │                     │
    │                  breach
    │                     ▼
    │                  breached
    │                     │
    │               end-breach
    │                     │
    │        ┌────────────┴────────────┐
    │        ▼                         ▼
    │      owned                    locked
    │
    ├── seize ─► seized ──release──► owned / available
    └── abandon ─► abandoned ──────► available / owned
```

Valid transitions (enforced via `FOR UPDATE` row lock):

| From      | To allowed                              |
|-----------|-----------------------------------------|
| available | owned                                   |
| owned     | occupied, locked, seized, abandoned     |
| occupied  | owned, locked, breached, seized         |
| locked    | owned, occupied, breached, seized       |
| breached  | owned, occupied, locked, seized         |
| seized    | owned, available                        |
| abandoned | available, owned                        |

---

## Database Migrations

| # | File | Table(s) |
|---|------|----------|
| 069 | `069_create_properties.sql` | `atc_properties` |
| 070 | `070_create_property_access.sql` | `atc_property_access`, `atc_property_keys` |
| 071 | `071_create_property_storage.sql` | `atc_property_stashes`, `atc_property_stash_items` |
| 072 | `072_create_property_garages.sql` | `atc_property_garages` |
| 073 | `073_create_property_runtime.sql` | `atc_property_runtime`, `atc_property_occupants` |

Run migrations:
```bash
pnpm --filter "@atc/db" db:migrate
```

---

## API Routes

| Method | Path | Capability | Service |
|--------|------|------------|---------|
| POST | `/api/v1/properties` | `property:register` | PropertyRuntimeService.register |
| GET | `/api/v1/properties/:id` | `property:read` | PropertyRuntimeService.findById |
| POST | `/api/v1/properties/:id/purchase` | `property:purchase` | PropertyRuntimeService.purchase |
| POST | `/api/v1/properties/:id/enter` | `property:occupancy` | InteriorStateService.enter |
| POST | `/api/v1/properties/:id/exit` | `property:occupancy` | InteriorStateService.exit |
| POST | `/api/v1/properties/:id/lock` | `property:lock` | InteriorStateService.lock |
| POST | `/api/v1/properties/:id/unlock` | `property:lock` | InteriorStateService.unlock |
| POST | `/api/v1/properties/:id/breach` | `property:breach` | EmergencyAccessService.breach |
| POST | `/api/v1/properties/:id/access/grant` | `property:access` | PropertyAccessService.grantAccess |
| POST | `/api/v1/properties/:id/access/:accessId/revoke` | `property:access` | PropertyAccessService.revokeAccess |
| GET | `/api/v1/properties/:id/storage/:stashId` | `property:storage` | StorageContainerService.getContents |
| POST | `/api/v1/properties/:id/storage/deposit` | `property:storage` | StorageContainerService.deposit |
| POST | `/api/v1/properties/:id/storage/withdraw` | `property:storage` | StorageContainerService.withdraw |
| POST | `/api/v1/properties/:id/garage/link` | `property:garage` | PropertyGarageService.linkGarage |
| POST | `/api/v1/properties/:id/garage/retrieve` | `property:garage` | PropertyGarageService.retrieveVehicle |

---

## EventBus Events

All events emitted via `ATC_PROPERTY_EVENTS` constants from `@atc/shared-types`:

| Event | Trigger |
|-------|---------|
| `atc:property:purchased` | PropertyRuntimeService.purchase |
| `atc:property:sold` | PropertyRuntimeService.sell |
| `atc:property:locked` | InteriorStateService.lock |
| `atc:property:unlocked` | InteriorStateService.unlock |
| `atc:property:breached` | EmergencyAccessService.breach |
| `atc:property:breach:ended` | EmergencyAccessService.endBreach |
| `atc:property:seized` | PropertyRuntimeService.seize |
| `atc:property:seizure:released` | PropertyRuntimeService.releaseSeizure |
| `atc:property:entered` | InteriorStateService.enter |
| `atc:property:exited` | InteriorStateService.exit |
| `atc:property:access:granted` | PropertyAccessService.grantAccess |
| `atc:property:access:revoked` | PropertyAccessService.revokeAccess |
| `atc:property:key:issued` | PropertyAccessService.issueKey |
| `atc:property:key:revoked` | PropertyAccessService.revokeKey |
| `atc:property:stash:deposit` | StorageContainerService.deposit |
| `atc:property:stash:withdraw` | StorageContainerService.withdraw |
| `atc:property:garage:linked` | PropertyGarageService.linkGarage |
| `atc:property:garage:unlinked` | PropertyGarageService.unlinkGarage |

---

## Services Architecture

```
PropertyRuntimeService
  └── PropertyRepository (state machine, CRUD)

InteriorStateService
  ├── PropertyRepository (lock/unlock transitions)
  └── PropertyRuntimeRepository (occupant tracking)

PropertyAccessService
  └── PropertyAccessRepository (grants, keys, append-only audit)

StorageContainerService
  └── PropertyStashRepository (deposit/withdraw with FOR UPDATE)

PropertyGarageService
  ├── PropertyGarageRepository (link/unlink)
  └── VehicleRuntimeService (delegate retrieve, Phase 30)

EmergencyAccessService
  ├── PropertyRepository (breach transition)
  ├── PropertyRuntimeRepository (breach state)
  └── PropertyAccessRepository (timed 5-min emergency grant)
```

---

## Concurrency Design

### State Transitions
All `transition()` calls use `SELECT ... FOR UPDATE` to serialize concurrent state changes. Invalid transitions raise `PropertyImmutableError` (422).

### Access Grant Duplicate Prevention
`grantAccess()` issues a `SELECT ... FOR UPDATE` on existing active grants of the same `(propertyId, principalId, accessType)` before inserting. Conflict raises `PropertyAccessConflictError` (409).

### Key Duplicate Prevention
`issueKey()` issues a `SELECT ... FOR UPDATE` on active keys for the same `(propertyId, issuedToPrincipalId)` before inserting. Conflict raises `PropertyKeyAlreadyIssuedError` (409).

### Stash Storage
- Stash row locked `FOR UPDATE` before capacity check
- Item existence checked: if same `itemName` exists, `ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)` (idempotent deposit)
- Withdraw locks stash then item row `FOR UPDATE`, checks quantity before decrement/delete

### Occupancy Tracking
Enter/exit updates `occupant_count` on `atc_property_runtime` within a transaction alongside the occupant record. State transitions from `owned` ↔ `occupied` are driven by the final count.

### Stale Occupant Cleanup
`InteriorStateService.cleanStaleOccupants(olderThanMinutes)` targets disconnected players. Call on player disconnect or via a scheduled task:
```sql
UPDATE atc_property_occupants
SET exited_at = NOW()
WHERE exited_at IS NULL AND entered_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)
```

---

## FiveM Bridge

**File:** `game/atc-core/server/property.lua`

All principal IDs resolved server-side via `ATC.Accounts.GetPrincipalId(source)`. Client values for coordinates sanitized with `tonumber()`. No client position trusted.

### SDK Functions

```lua
ATC.Properties.Enter(source, propertyId, cb)
ATC.Properties.Exit(source, propertyId, cb)
ATC.Properties.Lock(source, propertyId, cb)
ATC.Properties.Unlock(source, propertyId, cb)
ATC.Properties.Breach(source, propertyId, params, cb)
ATC.Properties.DepositItem(source, propertyId, stashId, itemName, quantity, metadata, cb)
ATC.Properties.WithdrawItem(source, propertyId, stashId, itemName, quantity, cb)
ATC.Properties.GetStorage(propertyId, stashId, cb)
ATC.Properties.RetrieveVehicle(source, propertyId, vehicleId, garageId, coords, heading, cb)
```

### Server Events (client → server)

```lua
-- Client fires:
TriggerServerEvent('atc:property:enter:request', propertyId)
TriggerServerEvent('atc:property:exit:request', propertyId)
TriggerServerEvent('atc:property:lock:request', propertyId, shouldLock)

-- Server replies:
TriggerClientEvent('atc:property:enter:response', source, status, data)
TriggerClientEvent('atc:property:exit:response', source, status, data)
TriggerClientEvent('atc:property:lock:response', source, status, data)
```

---

## Emergency Breach Protocol

1. Breaching officer calls `ATC.Properties.Breach(source, propertyId, { accessType, reason, agencyId })`
2. API validates `accessType` is `'emergency_law'` or `'emergency_ems'`
3. `EmergencyAccessService.breach()`:
   - Rejects if property is `seized` or `available` (no breach of unowned property)
   - Sets breach metadata on `atc_property_runtime`
   - Transitions property to `breached`
   - Grants temporary 5-minute emergency access (does not fail if officer already has access)
   - Emits `atc:property:breached`
4. End breach via `/api/v1/properties/:id/breach/end` (not yet routed — use direct service call)

---

## Error Response Map

| Error Class | HTTP | Code |
|-------------|------|------|
| PropertyValidationError | 400 | `PropertyValidation` |
| PropertyImmutableError | 422 | `PropertyImmutable` |
| EmergencyAccessError | 422 | `EmergencyAccess` |
| PropertyAlreadyOwnedError | 409 | `PropertyAlreadyOwned` |
| PropertyAccessConflictError | 409 | `PropertyAccessConflict` |
| PropertyKeyAlreadyIssuedError | 409 | `PropertyKeyAlreadyIssued` |
| PropertyGarageAlreadyLinkedError | 409 | `PropertyGarageAlreadyLinked` |
| StashCapacityError | 409 | `StashCapacity` |
| StashInsufficientQuantityError | 409 | `StashInsufficientQuantity` |
| PropertyAccessDeniedError | 403 | `PropertyAccessDenied` |
| PropertyNotFoundError | 404 | `PropertyNotFound` |
| PropertyNotOwnedError | 404 | `PropertyNotOwned` |
| PropertyAccessNotFoundError | 404 | `PropertyAccessNotFound` |
| PropertyKeyNotFoundError | 404 | `PropertyKeyNotFound` |
| StashNotFoundError | 404 | `StashNotFound` |
| StashItemNotFoundError | 404 | `StashItemNotFound` |
| PropertyGarageNotFoundError | 404 | `PropertyGarageNotFound` |

---

## Security Checklist

- [x] All property state transitions server-authoritative (no client ownership trust)
- [x] Principal IDs resolved server-side in FiveM bridge via `ATC.Accounts.GetPrincipalId`
- [x] Capability checks on all write routes (`property:register`, `property:purchase`, `property:lock`, `property:breach`, `property:access`, `property:storage`, `property:garage`, `property:occupancy`)
- [x] Emergency breaches audited via breach metadata on runtime record + EventBus emission
- [x] Emergency access is time-limited (5 minutes)
- [x] Stash payloads sanitized via Zod schema before repository calls
- [x] Occupant count protected against race by single transaction (INSERT + UPDATE in one tx)
- [x] Access records append-only (revoked_at set, no DELETE)
- [x] Key records append-only (revoked_at set, no DELETE)
- [x] Garage link records append-only (unlinked_at set, no DELETE)
- [x] No direct DB access outside repository layer
- [x] No hardcoded strings or credentials

---

## Agent Scope Boundary

This is an **Agent 1** deliverable. The following are explicitly **out of scope** and belong to Agent 2:

- Property analytics or occupancy dashboards
- MDT property investigation screens
- Historical property transaction reporting
- Intelligence correlation on property access patterns
- Read-side projections for property search/discovery

---

## Operational SQL

### List active occupants for a property
```sql
SELECT principal_id, entered_at
FROM atc_property_occupants
WHERE property_id = ? AND exited_at IS NULL
ORDER BY entered_at DESC;
```

### List all active access grants for a property
```sql
SELECT principal_id, access_type, granted_by_principal_id, granted_at, expires_at
FROM atc_property_access
WHERE property_id = ? AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > NOW())
ORDER BY granted_at DESC;
```

### List all stash contents
```sql
SELECT i.item_name, i.quantity, i.metadata, i.added_by_principal_id, i.added_at
FROM atc_property_stash_items i
JOIN atc_property_stashes s ON s.id = i.stash_record_id
WHERE s.property_id = ? AND s.stash_id = ?;
```

### Find all properties in breached state
```sql
SELECT p.id, p.name, p.address, r.breach_started_at, r.breach_by_principal_id, r.breach_reason
FROM atc_properties p
JOIN atc_property_runtime r ON r.property_id = p.id
WHERE p.status = 'breached';
```

### Emergency force-clear a breach
```sql
UPDATE atc_property_runtime
SET breach_started_at = NULL, breach_by_principal_id = NULL, breach_reason = NULL
WHERE property_id = ?;

UPDATE atc_properties SET status = 'owned', updated_at = NOW() WHERE id = ? AND status = 'breached';
```
