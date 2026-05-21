# Redis Usage Strategy

## Purpose

Redis serves three distinct roles in ATC:

| Role | Description |
|---|---|
| **Runtime State** | Fast access to current game state (sessions, spawned vehicles, door locks) |
| **Cache Layer** | Reduce MariaDB load for hot data (inventories, balances) |
| **Pub/Sub Bus** | Real-time event distribution between FiveM and API |

Redis is **not** the source of truth. MariaDB is. Redis holds derived or temporary state that can be reconstructed from MariaDB if lost.

---

## Key Naming Convention

```
atc:{service}:{type}:{identifier}
```

| Segment | Description | Example |
|---|---|---|
| `atc` | Global namespace | Always `atc` |
| `{service}` | Owning service | `session`, `inventory`, `economy` |
| `{type}` | Data type | `player`, `stash`, `balance` |
| `{identifier}` | Unique ID | UUID, source number, plate |

### Key Registry (All Active Keys)

```
# Sessions & Players
atc:session:{identifier}              → Player session object (TTL: session)
atc:player:source:{source}            → characterId string (TTL: session)
atc:player:online                     → Set of online sources (no TTL)
atc:player:risk:{characterId}         → Risk score number (TTL: 24h)

# Inventory
atc:inventory:player:{characterId}    → Inventory array (TTL: 120s)
atc:inventory:stash:{stashId}         → Stash array (TTL: 120s)
atc:inventory:lock:{ownerId}          → Write lock flag (TTL: 5s)
atc:inventory:hash:{characterId}      → Inventory hash for dupe detection (TTL: 30s)

# Economy
atc:economy:balance:{charId}:{curr}   → Balance decimal (TTL: 60s)
atc:economy:ratelimit:{charId}:tx     → Transaction rate counter (TTL: window)
atc:economy:marketprice:{itemId}      → Market price (TTL: 300s)
atc:economy:fraud:{charId}            → Fraud flag set (TTL: 24h)

# Territory
atc:territory:state:{territoryId}     → Ownership + cap state (no TTL)
atc:territory:contested:{id}          → Contested flag (TTL: capture window)
atc:territory:income_tick             → Next income tick epoch (no TTL)

# Housing
atc:housing:door:{propertyId}         → Lock state boolean (no TTL)
atc:housing:occupants:{propertyId}    → Set of characterIds (no TTL)

# Vehicles
atc:vehicle:spawned:{plate}           → Spawned vehicle data (no TTL)
atc:vehicle:garage:{garageId}:queue   → Garage operation queue (TTL: 30s)

# Admin
atc:admin:active:{adminSource}        → Admin session flag (TTL: session)
atc:ban:{identifier}                  → Active ban record (TTL: ban expiry, 0=permanent)

# Rate Limiting
atc:ratelimit:{playerId}:{event}      → Request count (TTL: window)

# Cache invalidation
atc:cache:version:{resource}          → Version counter for cache busting
```

---

## TTL Policy

| Data Type | TTL | Rationale |
|---|---|---|
| Player session | Session duration | Cleared on disconnect |
| Source → CharId mapping | Session duration | Cleared on disconnect |
| Inventory cache | 120s | Hot data, short TTL, event-invalidated on write |
| Balance cache | 60s | Very hot, short TTL, event-invalidated on write |
| Market prices | 300s | Updated by market simulation cron |
| Risk score | 24h | Persisted to DB daily, Redis is working copy |
| Rate limit counters | Window duration | Auto-expire, sliding window |
| Inventory write lock | 5s | Safety: lock must auto-expire |
| Door state | No TTL | Persistent until changed; reload from DB on startup |
| Territory state | No TTL | Persistent until event changes it |
| Active bans | Ban expiry | Redis TTL enforces ban duration |

---

## Cache-Aside Pattern

```
Read flow:
  1. Check Redis cache
  2a. HIT  → return cached value
  2b. MISS → query MariaDB
  3. Store result in Redis with TTL
  4. Return result

Write flow:
  1. Write to MariaDB (source of truth)
  2. Invalidate Redis cache (DEL key)
  3. Emit EventBus event with new data
  4. Subscribers can optionally pre-warm cache
```

```typescript
// packages/cache/src/patterns/cache-aside.ts

export async function cacheAside<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>
): Promise<T> {
    const cached = await redis.get<T>(key)
    if (cached !== null) return cached

    const fresh = await loader()
    await redis.set(key, fresh, { ex: ttlSeconds })
    return fresh
}

// Usage:
const inventory = await cacheAside(
    `atc:inventory:player:${characterId}`,
    120,
    () => inventoryRepo.getByCharacterId(characterId)
)
```

---

## Write-Through Pattern

Used for high-frequency writes where we need Redis to stay current:

```typescript
// Write to DB, then update cache
async function updateBalance(characterId: string, currency: string, amount: number) {
    const newBalance = await economyRepo.updateBalance(characterId, currency, amount)
    await redis.set(
        `atc:economy:balance:${characterId}:${currency}`,
        newBalance.toString(),
        { ex: 60 }
    )
    return newBalance
}
```

---

## Pub/Sub Architecture

Redis Pub/Sub connects the FiveM Lua layer to the Node.js API:

### Channels

| Channel | Publisher | Subscribers | Purpose |
|---|---|---|---|
| `atc:events:player` | API | FiveM | Player state changes |
| `atc:events:inventory` | API | FiveM | Inventory mutations |
| `atc:events:economy` | API | FiveM | Economy updates |
| `atc:events:territory` | API | FiveM | Zone ownership changes |
| `atc:events:admin` | API | FiveM | Admin actions |
| `atc:events:system` | API | FiveM | Server status, restarts |

### Message Format

```typescript
interface RedisEvent {
    channel: string;     // 'atc:events:inventory'
    event: string;       // 'atc:inventory:item:added'
    version: number;     // Payload schema version
    timestamp: number;   // Unix ms
    traceId: string;     // UUID v7
    payload: unknown;    // Event-specific data
}
```

### API Side (Publisher)

```typescript
// packages/events/src/event-bus.ts

export class EventBus {
    async emit(event: string, payload: unknown): Promise<void> {
        const domain = event.split(':')[1]  // e.g., 'inventory' from 'atc:inventory:item:added'
        const channel = `atc:events:${domain}`

        const message: RedisEvent = {
            channel,
            event,
            version: 1,
            timestamp: Date.now(),
            traceId: generateId(),
            payload
        }

        await redis.publish(channel, JSON.stringify(message))
    }
}
```

### FiveM Side (Subscriber)

```lua
-- fivem/[atc]/server/redis_subscriber.lua
-- Polls Redis pub/sub via HTTP long-poll endpoint

CreateThread(function()
    while true do
        local res = PerformHttpRequest(
            ATC.Config.ApiUrl .. '/api/v1/events/subscribe',
            function(status, data)
                if status == 200 and data then
                    local events = json.decode(data)
                    for _, event in ipairs(events) do
                        ATC.Core.EventBus.Handle(event)
                    end
                end
            end,
            'GET',
            '',
            { Authorization = 'Bearer ' .. ATC.Config.ServerToken }
        )
        Wait(100)  -- 100ms poll interval (or use SSE/WebSocket in Phase 2)
    end
end)
```

Note: In Phase 2, this migrates to Server-Sent Events (SSE) or WebSocket for true push delivery.

---

## Redis Cluster Considerations (Phase 2+)

When scaling to Redis Cluster:

1. **Key hashing tags** — group related keys on same shard:
   ```
   atc:inventory:{player:{characterId}}  → uses {} tag
   atc:economy:{balance:{characterId}}   → uses {} tag
   ```

2. **No cross-slot operations** — never MGET/MSET across different hash slots

3. **Pub/Sub** — use Redis Streams (XADD/XREAD) instead of basic pub/sub, as it supports consumer groups and persistence

4. **Lua scripts** — all Redis Lua scripts must use KEYS[] (no dynamic key generation in script)

---

## Startup Warm-Up Sequence

On API server start:

```typescript
async function warmRedisCache(): Promise<void> {
    // Restore territory state from DB (no TTL data needs restoration)
    const territories = await territoryRepo.getAll()
    for (const t of territories) {
        await redis.set(`atc:territory:state:${t.id}`, t)
    }

    // Restore door states
    const doors = await housingRepo.getAllDoorStates()
    for (const door of doors) {
        await redis.set(`atc:housing:door:${door.propertyId}`, door.isLocked)
    }

    // Active bans (so ban checks are fast)
    const bans = await adminRepo.getActiveBans()
    for (const ban of bans) {
        const ttl = ban.permanent ? 0 : Math.floor((ban.expiresAt.getTime() - Date.now()) / 1000)
        await redis.set(`atc:ban:${ban.identifier}`, ban, ttl > 0 ? { ex: ttl } : {})
    }
}
```

---

## Redis Client Configuration

```typescript
// packages/cache/src/client.ts

import { Redis } from 'ioredis'

export const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    db: 0,
    keyPrefix: '',          // We manage prefixes manually (for clarity)
    lazyConnect: false,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    enableOfflineQueue: false   // Fail fast if Redis is down
})
```
