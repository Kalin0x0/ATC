# Service Boundaries

## Boundary Definition

Each service owns its domain completely. No service directly reads or writes another service's database tables. Cross-service communication happens exclusively through:

1. **Event Bus** — for fire-and-forget notifications
2. **Internal API calls** — for request/response within the API server (service-to-service function calls)
3. **Redis shared state** — for high-frequency runtime reads (read-only cache, never write another service's keys)

---

## Player Service

**Owns:** Player sessions, identity, character state, spawn lifecycle

**Database tables:**
- `players` — identifier, discord, license, created_at
- `characters` — player_id, name, appearance, metadata, last_seen
- `player_sessions` — character_id, source, connected_at, disconnected_at, ip

**Redis keys (owns):**
- `atc:session:{identifier}` — active session data (TTL: session)
- `atc:player:source:{source}` — source → character_id mapping (TTL: session)
- `atc:player:online` — sorted set of online player sources

**REST endpoints:**
```
GET    /api/v1/players/{identifier}
GET    /api/v1/players/{identifier}/characters
POST   /api/v1/players/{identifier}/characters
GET    /api/v1/players/{identifier}/session
POST   /api/v1/players/session/start
DELETE /api/v1/players/session/end
```

**Events published:**
- `atc:player:connected` — when session starts
- `atc:player:disconnected` — when session ends
- `atc:player:character:selected`
- `atc:player:character:created`

**Events consumed:** none (root service)

**Does NOT own:** inventory state, economy balance, vehicle list

---

## Economy Service

**Owns:** All currency balances, all financial transactions, market pricing

**Database tables:**
- `economy_accounts` — character_id, currency_type, balance
- `economy_transactions` — id, from_id, to_id, amount, currency, type, reason, created_at
- `economy_fraud_flags` — transaction_id, flag_type, severity, reviewed

**Redis keys (owns):**
- `atc:economy:balance:{characterId}:{currency}` — cached balance (TTL: 60s)
- `atc:economy:ratelimit:{characterId}:transfer` — transfer rate limit
- `atc:economy:marketprice:{itemId}` — current market price (TTL: varies)

**REST endpoints:**
```
GET  /api/v1/economy/{characterId}/balances
POST /api/v1/economy/transfer
POST /api/v1/economy/deposit
POST /api/v1/economy/withdraw
GET  /api/v1/economy/{characterId}/transactions
GET  /api/v1/economy/market/prices
```

**Events published:**
- `atc:economy:transaction:completed`
- `atc:economy:transaction:failed`
- `atc:economy:balance:updated`
- `atc:economy:fraud:detected`

**Events consumed:**
- `atc:player:disconnected` — flush balance cache

**Business rules enforced here (not in FiveM):**
- Minimum balance check before transfer
- Daily transaction limits
- Fraud pattern detection
- Negative balance prevention

---

## Inventory Service

**Owns:** All item storage, stashes, containers

**Database tables:**
- `inventory_items` — id, owner_id, owner_type, item_name, quantity, metadata, slot
- `inventory_stashes` — id, owner_id, owner_type, max_weight, label
- `item_definitions` — name, label, weight, stackable, usable, metadata_schema

**Redis keys (owns):**
- `atc:inventory:player:{characterId}` — cached inventory (TTL: 120s)
- `atc:inventory:stash:{stashId}` — cached stash (TTL: 120s)
- `atc:inventory:lock:{stashId}` — stash write lock (TTL: 5s)

**REST endpoints:**
```
GET    /api/v1/inventory/{ownerId}
POST   /api/v1/inventory/{ownerId}/add
DELETE /api/v1/inventory/{ownerId}/remove
POST   /api/v1/inventory/{ownerId}/move
GET    /api/v1/inventory/stash/{stashId}
POST   /api/v1/inventory/transfer
GET    /api/v1/inventory/items/definitions
```

**Events published:**
- `atc:inventory:item:added`
- `atc:inventory:item:removed`
- `atc:inventory:item:used`
- `atc:inventory:exploit:detected`

**Events consumed:**
- `atc:player:disconnected` — flush inventory cache
- `atc:housing:exited` — close stash access
- `atc:vehicle:despawned` — close vehicle trunk

**Business rules enforced here:**
- Weight limits
- Stack limits
- Duplicate item detection (anti-dupe)
- Concurrent write locks (Redis)

---

## Territory Service

**Owns:** Zone definitions, ownership state, capture events, income ticks

**Database tables:**
- `territories` — id, name, polygon_data, owner_faction_id, captured_at
- `territory_events` — territory_id, event_type, faction_id, timestamp
- `territory_income_log` — territory_id, faction_id, amount, paid_at

**Redis keys (owns):**
- `atc:territory:state:{territoryId}` — current ownership + cap state (TTL: none, event-driven)
- `atc:territory:contested:{territoryId}` — contested status (TTL: cap duration)
- `atc:territory:income_tick` — next income tick timestamp

**REST endpoints:**
```
GET  /api/v1/territory
GET  /api/v1/territory/{id}
POST /api/v1/territory/{id}/claim
POST /api/v1/territory/{id}/contest
GET  /api/v1/territory/{id}/income-log
```

**Events published:**
- `atc:territory:contested`
- `atc:territory:captured`
- `atc:territory:income:paid`
- `atc:territory:owner:changed`

**Events consumed:**
- `atc:player:disconnected` — update player-in-zone tracking

---

## Housing Service

**Owns:** Properties, furniture, access lists, door states

**Database tables:**
- `properties` — id, label, type, coords, price, owner_character_id, for_sale
- `property_furniture` — property_id, furniture_id, position, rotation
- `property_keys` — property_id, character_id, access_level
- `property_stashes` — property_id, stash_id

**Redis keys (owns):**
- `atc:housing:door:{propertyId}` — door lock state (TTL: none)
- `atc:housing:occupants:{propertyId}` — set of characterIds inside (TTL: none)

**REST endpoints:**
```
GET  /api/v1/housing/properties
GET  /api/v1/housing/properties/{id}
POST /api/v1/housing/properties/{id}/purchase
POST /api/v1/housing/properties/{id}/keys/grant
POST /api/v1/housing/properties/{id}/door/toggle
PUT  /api/v1/housing/properties/{id}/furniture
```

**Events published:**
- `atc:housing:entered`
- `atc:housing:exited`
- `atc:housing:door:locked`
- `atc:housing:door:unlocked`
- `atc:housing:purchased`

**Events consumed:**
- `atc:player:disconnected` — remove from occupants

---

## Vehicle Service

**Owns:** Vehicle registry, garage state, impound, mods, ownership

**Database tables:**
- `vehicles` — id, plate, model, owner_character_id, garage_id, mods_json, fuel, body
- `garages` — id, label, type, coords, access_faction
- `impound_log` — vehicle_id, reason, impounded_by, cost, released_at

**Redis keys (owns):**
- `atc:vehicle:spawned:{plate}` — spawned vehicle network entity + owner
- `atc:garage:queue:{garageId}` — pending garage operations

**REST endpoints:**
```
GET    /api/v1/vehicles/{characterId}
POST   /api/v1/vehicles/register
DELETE /api/v1/vehicles/{plate}
POST   /api/v1/vehicles/{plate}/garage/in
POST   /api/v1/vehicles/{plate}/garage/out
POST   /api/v1/vehicles/{plate}/impound
PUT    /api/v1/vehicles/{plate}/mods
```

**Events published:**
- `atc:vehicle:spawned`
- `atc:vehicle:despawned`
- `atc:vehicle:impounded`
- `atc:vehicle:transferred`

**Events consumed:**
- `atc:player:disconnected` — store vehicle state if spawned

---

## Admin Service

**Owns:** Bans, warnings, audit logs, evidence bundles, admin sessions

**Database tables:**
- `bans` — id, target_identifier, reason, duration, issued_by, evidence_id, created_at
- `warnings` — id, target_identifier, reason, issued_by, created_at
- `audit_log` — id, actor_id, action, target_id, metadata_json, timestamp
- `evidence_bundles` — id, target_identifier, description, screenshot_url, event_log_json

**Redis keys (owns):**
- `atc:admin:active:{adminSource}` — active admin session
- `atc:ban:identifier:{identifier}` — active ban record (TTL: ban expiry, TTL 0 = permanent)

**REST endpoints:**
```
GET    /api/v1/admin/players
POST   /api/v1/admin/bans
DELETE /api/v1/admin/bans/{id}
GET    /api/v1/admin/audit-log
POST   /api/v1/admin/evidence
GET    /api/v1/admin/evidence/{id}
POST   /api/v1/admin/warnings
GET    /api/v1/admin/players/{identifier}/history
```

**Events published:**
- `atc:admin:action:executed`
- `atc:admin:ban:issued`
- `atc:admin:ban:lifted`

**Events consumed:**
- `atc:security:violation:detected` — auto-flag player

---

## Cross-Service Communication Contract

```
Service A needs data from Service B:
  ├── If it's a READ during a request → call Service B's internal function directly
  │   (same process, TypeScript function call)
  │
  ├── If it's a side-effect notification → publish to Event Bus
  │   Service B subscribes and reacts asynchronously
  │
  └── If it's high-frequency shared state → read from Redis (Service B owns and writes,
      Service A reads with agreed key contract)
```

**Redis key ownership is explicit.** Only the owning service writes to its keys. Other services may read them but must never write.
