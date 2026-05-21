# Event Standards

## Naming Convention

### Pattern
```
atc:{domain}:{noun}:{verb}
```

### Components

| Component | Description | Examples |
|---|---|---|
| `atc` | Fixed namespace prefix | Always `atc` |
| `{domain}` | Service/feature area | `player`, `inventory`, `economy`, `territory` |
| `{noun}` | The subject of the event | `item`, `transaction`, `character`, `zone` |
| `{verb}` | Past tense action (completed fact) | `added`, `removed`, `updated`, `created` |

### Special Patterns

```
Request events (client → server):
  atc:{domain}:request:{action}
  Example: atc:inventory:request:use_item
  Example: atc:player:request:respawn

Internal events (server → server, Event Bus):
  atc:{domain}:{noun}:{verb}
  Example: atc:economy:transaction:completed

System events (Core → plugins):
  atc:core:{noun}:{verb}
  Example: atc:core:plugin:ready
  Example: atc:core:server:started

Error events:
  atc:{domain}:{noun}:failed
  Example: atc:economy:transaction:failed
  Example: atc:inventory:item:add_failed

Security events:
  atc:security:{noun}:{verb}
  Example: atc:security:violation:detected
  Example: atc:security:ratelimit:exceeded
```

---

## Complete Event Registry

### Core Events

| Event | Direction | Description |
|---|---|---|
| `atc:core:server:started` | Core → Plugins | Server is fully ready |
| `atc:core:plugin:ready` | Plugin → Core | Plugin initialized |
| `atc:core:plugin:error` | Plugin → Core | Plugin initialization failed |

### Player Events

| Event | Direction | Payload |
|---|---|---|
| `atc:player:connected` | Server → Bus | `{ source, identifier, characterId }` |
| `atc:player:disconnected` | Server → Bus | `{ source, identifier, characterId, reason }` |
| `atc:player:character:selected` | Server → Bus | `{ source, characterId }` |
| `atc:player:character:created` | Server → Bus | `{ source, characterId, name }` |
| `atc:player:position:updated` | Server → Bus | `{ source, characterId, coords }` |
| `atc:player:request:respawn` | Client → Server | `{ hospitalId? }` |
| `atc:player:request:character_select` | Client → Server | `{}` |

### Inventory Events

| Event | Direction | Payload |
|---|---|---|
| `atc:inventory:item:added` | Server → Bus | `{ characterId, item, quantity, metadata }` |
| `atc:inventory:item:removed` | Server → Bus | `{ characterId, item, quantity, reason }` |
| `atc:inventory:item:used` | Server → Bus | `{ characterId, item, metadata }` |
| `atc:inventory:item:dropped` | Server → Bus | `{ characterId, item, quantity, coords }` |
| `atc:inventory:exploit:detected` | Server → Bus | `{ characterId, type, details }` |
| `atc:inventory:request:use_item` | Client → Server | `{ slot, itemName }` |
| `atc:inventory:request:drop_item` | Client → Server | `{ slot, quantity }` |
| `atc:inventory:request:give_item` | Client → Server | `{ targetSource, slot, quantity }` |

### Economy Events

| Event | Direction | Payload |
|---|---|---|
| `atc:economy:transaction:completed` | Server → Bus | `{ transactionId, from, to, amount, currency, type }` |
| `atc:economy:transaction:failed` | Server → Bus | `{ from, to, amount, currency, reason }` |
| `atc:economy:balance:updated` | Server → Client | `{ characterId, currency, balance, delta }` |
| `atc:economy:fraud:detected` | Server → Bus | `{ characterId, flagType, severity }` |
| `atc:economy:request:transfer` | Client → Server | `{ targetSource, amount, currency }` |
| `atc:economy:request:atm:withdraw` | Client → Server | `{ amount }` |
| `atc:economy:request:atm:deposit` | Client → Server | `{ amount }` |

### Territory Events

| Event | Direction | Payload |
|---|---|---|
| `atc:territory:contested` | Server → Bus | `{ territoryId, challengerFactionId }` |
| `atc:territory:captured` | Server → Bus | `{ territoryId, newOwnerFactionId, previousOwnerFactionId }` |
| `atc:territory:owner:changed` | Server → Client (all) | `{ territoryId, ownerFactionId, color }` |
| `atc:territory:income:paid` | Server → Bus | `{ territoryId, factionId, amount }` |

### Housing Events

| Event | Direction | Payload |
|---|---|---|
| `atc:housing:entered` | Server → Bus | `{ characterId, propertyId }` |
| `atc:housing:exited` | Server → Bus | `{ characterId, propertyId }` |
| `atc:housing:door:locked` | Server → Bus | `{ propertyId, lockedBy }` |
| `atc:housing:door:unlocked` | Server → Bus | `{ propertyId, unlockedBy }` |
| `atc:housing:purchased` | Server → Bus | `{ characterId, propertyId, price }` |

### Vehicle Events

| Event | Direction | Payload |
|---|---|---|
| `atc:vehicle:spawned` | Server → Bus | `{ plate, model, characterId, networkId }` |
| `atc:vehicle:despawned` | Server → Bus | `{ plate, characterId }` |
| `atc:vehicle:impounded` | Server → Bus | `{ plate, reason, officerId }` |
| `atc:vehicle:transferred` | Server → Bus | `{ plate, fromId, toId }` |

### Combat Events

| Event | Direction | Payload |
|---|---|---|
| `atc:combat:player:downed` | Server → Bus | `{ characterId, source, weapon, coords }` |
| `atc:combat:player:died` | Server → Bus | `{ characterId, coords }` |
| `atc:combat:player:revived` | Server → Bus | `{ characterId, revivedBy }` |
| `atc:combat:player:respawned` | Server → Bus | `{ characterId, hospitalId }` |

### Security Events

| Event | Direction | Payload |
|---|---|---|
| `atc:security:violation:detected` | Server → Bus | `{ source, characterId, violationType, severity, details }` |
| `atc:security:ratelimit:exceeded` | Server → Bus | `{ source, characterId, event, windowMs }` |
| `atc:security:ban:issued` | Server → Bus | `{ identifier, reason, duration, issuedBy }` |
| `atc:security:ban:checked` | Server (internal) | `{ identifier, isBanned, banData }` |

### Admin Events

| Event | Direction | Payload |
|---|---|---|
| `atc:admin:action:executed` | Server → Bus | `{ adminId, actionType, targetId, metadata }` |
| `atc:admin:ban:issued` | Server → Bus | `{ targetId, reason, duration, adminId }` |
| `atc:admin:ban:lifted` | Server → Bus | `{ targetId, adminId }` |

---

## Event Payload Standards

### Required Fields (all events)
```typescript
interface BaseEventPayload {
  _version: number;        // Event schema version (increment on breaking change)
  _timestamp: number;      // Unix timestamp ms (server-generated, never client)
  _traceId: string;        // UUID for distributed tracing
}
```

### Request Events (client → server)
```typescript
interface BaseRequestPayload {
  // No _timestamp — server sets it on receipt
  // No _traceId — server generates it
  // No _version — validated against server schema
}
```

### Full Example
```typescript
// atc:inventory:item:added
interface InventoryItemAddedPayload extends BaseEventPayload {
  _version: 1;
  characterId: string;     // UUID v7
  item: string;            // Item definition name
  quantity: number;
  metadata: Record<string, unknown>;
  slot: number;
  source: string;          // Why it was added: 'admin_give', 'loot', 'craft', etc.
}
```

---

## Client → Server Event Rules

The Event Firewall enforces these rules:

1. **Whitelist only** — any event not in the whitelist is silently dropped and logged
2. **Rate limits** — each whitelisted event has a per-player, per-window limit
3. **Payload validation** — Zod schema validated on server before handler runs
4. **No trust** — client-provided positions, amounts, and IDs are always cross-checked

### Whitelist Example
```lua
-- In ATC Core (fivem/[atc]/server/firewall.lua)
ATC.Core.EventFirewall.Register({
    ['atc:inventory:request:use_item'] = {
        rateLimit = { window = 1000, max = 5 },
        schema = 'inventory.use_item_request'
    },
    ['atc:player:request:respawn'] = {
        rateLimit = { window = 60000, max = 1 },
        schema = 'player.respawn_request'
    },
    ['atc:economy:request:atm:withdraw'] = {
        rateLimit = { window = 10000, max = 3 },
        schema = 'economy.atm_withdraw_request'
    }
})
```

---

## Event Versioning

When an event payload needs a breaking change:

1. Increment `_version` in the payload
2. Emit both old and new versions for one release cycle
3. Update all subscribers
4. Remove the old version in the next major release

```lua
-- Emitting a versioned event
ATC.Core.EventBus.Emit('atc:inventory:item:added', {
    _version = 2,  -- was 1
    -- new payload structure
})
```

---

## Anti-Patterns (Never Do)

```lua
-- ❌ WRONG: Using AddEventHandler for cross-plugin communication
AddEventHandler('someRandomEvent', function(data)
    -- This bypasses the firewall and has no schema validation
end)

-- ✅ CORRECT: Register through ATC Core
ATC.Core.EventBus.On('atc:inventory:item:added', function(payload)
    -- Goes through Event Bus with type checking
end)

-- ❌ WRONG: Client triggers undeclared event
TriggerServerEvent('atc:economy:forceGiveMoney', 999999)
-- Blocked by firewall immediately

-- ❌ WRONG: Server event without traceId
TriggerClientEvent('atc:inventory:item:added', source, { item = 'water' })
-- Always include full payload with _version, _timestamp, _traceId
```
