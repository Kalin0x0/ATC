# Security Architecture

## Security Model

ATC operates on a **zero-trust client model**. The FiveM client is treated as a hostile environment. Every value received from the client is validated, rate-limited, and logged. The server is the only source of truth.

---

## Security Layers

```
Layer 1: Connection Guard
  └─ License/Discord check, IP logging, ban check on connect

Layer 2: Event Firewall
  └─ Whitelist enforcement, unknown events dropped + logged

Layer 3: Rate Limiter
  └─ Per-player, per-event, sliding window limits

Layer 4: Payload Validator
  └─ Zod schema validation of all client-sent data

Layer 5: Business Rule Guard
  └─ Server-side cross-check (coords, ownership, balances)

Layer 6: Risk Score Engine
  └─ Pattern-based player risk scoring (0-100)

Layer 7: Audit Logger
  └─ Immutable log of all sensitive operations

Layer 8: Economy Guard
  └─ Fraud detection, anomaly detection on transactions

Layer 9: Inventory Guard
  └─ Anti-dupe, concurrent write locks, hash verification

Layer 10: Admin Abuse Logger
  └─ All admin actions logged with evidence bundle option
```

---

## Layer 1: Connection Guard

```lua
-- fivem/[atc]/server/connection.lua

AddEventHandler('playerConnecting', function(name, setKickReason, deferrals)
    local source = source
    deferrals.defer()

    local identifier = GetPlayerIdentifierByType(source, 'license')
    if not identifier then
        deferrals.done('No valid license identifier found.')
        return
    end

    -- Check active ban
    local ban = ATC.SDK.Admin.GetActiveBan(identifier)
    if ban then
        deferrals.done(string.format(
            'You are banned.\nReason: %s\nExpires: %s',
            ban.reason,
            ban.permanent and 'Never' or os.date('%Y-%m-%d', ban.expires_at)
        ))
        return
    end

    -- Log connection attempt
    ATC.Core.Log.Info('player.connecting', {
        identifier = identifier,
        name = name,
        ip = GetPlayerEndpoint(source)
    })

    deferrals.done()
end)
```

---

## Layer 2: Event Firewall

The Event Firewall is the primary protection against client-side exploits.

### Architecture

```
Client sends TriggerServerEvent(eventName, payload)
  │
  ▼
ATC Core intercepts ALL server events
  │
  ├── Is eventName in whitelist?
  │   ├── NO  → Drop, log atc:security:violation:detected (severity: LOW)
  │   └── YES → Continue
  │
  ├── Is player rate-limited for this event?
  │   ├── YES → Drop, log atc:security:ratelimit:exceeded
  │   └── NO  → Increment counter, continue
  │
  ├── Does payload pass Zod schema?
  │   ├── NO  → Drop, log atc:security:violation:detected (severity: MEDIUM)
  │   └── YES → Continue
  │
  └── Call registered handler
```

### Whitelist Registration

```lua
-- fivem/[atc]/server/firewall.lua

ATC.Core.Firewall = {}
local _whitelist = {}

function ATC.Core.Firewall.Register(eventName, config)
    _whitelist[eventName] = {
        rateLimit = config.rateLimit or { window = 1000, max = 10 },
        schema = config.schema,      -- Zod schema name (validated server-side via API)
        requireCharacter = config.requireCharacter ~= false  -- default: true
    }
end

-- Intercept all events
AddEventHandler('__cfx_internal:serverCallback', function()
    -- Not used — we intercept at the net event level
end)

-- Master interceptor
local _origAddEventHandler = AddEventHandler
function AddEventHandler(eventName, handler)
    if string.sub(eventName, 1, 4) == 'atc:' then
        -- Wrap with firewall
        _origAddEventHandler(eventName, function(...)
            local src = source
            if not ATC.Core.Firewall.Check(eventName, src, ...) then
                return  -- Blocked
            end
            handler(...)
        end)
    else
        _origAddEventHandler(eventName, handler)
    end
end
```

---

## Layer 3: Rate Limiter

```typescript
// packages/security/src/rate-limiter.ts

interface RateLimitConfig {
    windowMs: number;    // Time window in milliseconds
    max: number;         // Max requests per window
    keyPrefix: string;   // Redis key prefix
}

export class RateLimiter {
    async check(playerId: string, event: string, config: RateLimitConfig): Promise<boolean> {
        const key = `atc:ratelimit:${playerId}:${event}`
        const count = await redis.incr(key)

        if (count === 1) {
            await redis.pexpire(key, config.windowMs)
        }

        if (count > config.max) {
            await this.auditLog.log({
                type: 'RATE_LIMIT_EXCEEDED',
                playerId,
                event,
                count,
                max: config.max
            })
            return false
        }

        return true
    }
}
```

### Default Rate Limits

| Event | Window | Max |
|---|---|---|
| `atc:inventory:request:use_item` | 1000ms | 5 |
| `atc:inventory:request:drop_item` | 2000ms | 3 |
| `atc:economy:request:atm:withdraw` | 10000ms | 3 |
| `atc:economy:request:transfer` | 5000ms | 2 |
| `atc:player:request:respawn` | 60000ms | 1 |
| `atc:vehicle:request:garage:out` | 5000ms | 2 |
| `atc:housing:request:door:toggle` | 1000ms | 5 |

---

## Layer 4: Payload Validator

All client payloads are validated using Zod schemas:

```typescript
// packages/security/src/schemas/inventory.schemas.ts

export const useItemRequestSchema = z.object({
    slot: z.number().int().min(0).max(99),
    itemName: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/)
})

export const dropItemRequestSchema = z.object({
    slot: z.number().int().min(0).max(99),
    quantity: z.number().int().min(1).max(999)
})
```

Coordinates from client are **never trusted** — server calculates position from source.

---

## Layer 5: Business Rule Guard

```lua
-- Example: Use item handler (server)
ATC.Core.Firewall.Register('atc:inventory:request:use_item', {
    rateLimit = { window = 1000, max = 5 },
    schema = 'inventory.use_item_request'
})

RegisterNetEvent('atc:inventory:request:use_item')
AddEventHandler('atc:inventory:request:use_item', function(payload)
    local source = source
    local player, err = ATC.SDK.Player.Get(source)
    if not player then return end  -- session already validated by firewall

    -- Server-side business rules (never trust client claims)
    if player.isDead then return end           -- Dead players can't use items
    if player.isHandcuffed then return end     -- Restrained players can't use items

    -- Validate item ownership (server checks, not client)
    local hasItem = ATC.SDK.Inventory.HasItem(player.characterId, payload.itemName, 1)
    if not hasItem then
        ATC.Core.Risk.AddPoints(source, 5, 'item_use_without_ownership')
        return
    end

    -- Execute via API (business logic server-side)
    ATC.SDK.Inventory.UseItem(player.characterId, payload.itemName)
end)
```

---

## Layer 6: Risk Score Engine

```typescript
// packages/security/src/risk-engine.ts

export interface RiskEvent {
    type: string;
    points: number;
    description: string;
    decayRate: number;   // Points per hour that decay
}

const RISK_EVENTS: Record<string, RiskEvent> = {
    'item_use_without_ownership':  { points: 5,  decayRate: 1, description: 'Used item they don\'t own' },
    'unknown_event_triggered':     { points: 10, decayRate: 2, description: 'Triggered unknown event' },
    'rate_limit_exceeded':         { points: 3,  decayRate: 1, description: 'Hit rate limit' },
    'schema_validation_failed':    { points: 15, decayRate: 5, description: 'Sent malformed payload' },
    'coord_mismatch':              { points: 20, decayRate: 2, description: 'Claimed impossible coordinates' },
    'economy_anomaly':             { points: 25, decayRate: 3, description: 'Economy fraud pattern' },
    'inventory_dupe_detected':     { points: 50, decayRate: 0, description: 'Item duplication detected' },
    'menu_injection_detected':     { points: 75, decayRate: 0, description: 'Menu injection attempt' },
}

// Risk thresholds:
// 0-30:   Normal player
// 30-60:  Elevated — extra logging
// 60-85:  High — admin flagged, some features restricted
// 85-100: Critical — auto-kick + admin notification
// 100+:   Auto-ban evidence bundle created
```

Risk score is stored in Redis (`atc:risk:score:{characterId}`) and persisted to DB daily.

---

## Layer 7: Audit Log

```typescript
// packages/security/src/audit-logger.ts

interface AuditEntry {
    id: string;           // UUID v7
    actorId: string;      // characterId or 'system'
    actorSource: number;  // FiveM source (0 if system)
    actionType: string;   // e.g. 'admin.ban', 'economy.transfer', 'inventory.give'
    targetId?: string;    // Target characterId if applicable
    metadata: Record<string, unknown>;
    ip?: string;
    timestamp: Date;
}
```

### Immutability Rules
1. Audit entries are **never updated or deleted** (append-only)
2. Database user has INSERT only — no UPDATE/DELETE on `audit_log`
3. Audit log is replicated to cold storage weekly
4. Admin cannot read their own audit entries (separation of concerns)

---

## Layer 8: Economy Guard

```typescript
// packages/security/src/economy-guard.ts

const FRAUD_PATTERNS = {
    RAPID_TRANSFERS: {
        // >10 transfers in 60 seconds
        check: (history: Transaction[]) => {
            const recent = history.filter(t => Date.now() - t.createdAt.getTime() < 60000)
            return recent.length > 10
        },
        severity: 2,
        action: 'flag'
    },
    LARGE_AMOUNT: {
        // Single transfer > 500,000
        check: (t: Transaction) => t.amount > 500000,
        severity: 2,
        action: 'hold_and_review'
    },
    ROUND_TRIP: {
        // Money sent and received back within 10 minutes
        check: (history: Transaction[]) => detectRoundTrip(history),
        severity: 3,
        action: 'freeze_and_notify_admin'
    },
    IMPOSSIBLE_INCOME: {
        // Balance grew faster than any legitimate source
        check: (snapshots: BalanceSnapshot[]) => detectImpossibleGrowth(snapshots),
        severity: 3,
        action: 'freeze_and_notify_admin'
    }
}
```

---

## Layer 9: Inventory Guard

Anti-duplication system:

```lua
-- Server-side inventory write lock (Redis-based mutex)
function ATC.SDK.Inventory._AcquireLock(characterId, timeoutMs)
    local lockKey = 'atc:inventory:lock:' .. characterId
    local acquired = ATC.SDK._Cache.SetNX(lockKey, 1, timeoutMs or 5000)
    return acquired
end

function ATC.SDK.Inventory._ReleaseLock(characterId)
    ATC.SDK._Cache.Del('atc:inventory:lock:' .. characterId)
end

-- Inventory hash for dupe detection
-- Hash of (characterId, itemName, quantity) stored per transaction
-- If same hash arrives twice in 500ms → dupe attempt → risk score +50
```

---

## Layer 10: Admin Abuse Logger

```typescript
// All admin actions go through this wrapper — no exceptions
export async function executeAdminAction(
    adminId: string,
    adminSource: number,
    action: AdminActionType,
    targetId: string,
    metadata: Record<string, unknown>
) {
    // Permission check
    const admin = await ATCAdmin.getById(adminId)
    if (!admin.hasPermission(action)) {
        throw new ATCPermissionError('ADMIN_PERMISSION_DENIED', `Missing: ${action}`)
    }

    // Execute action
    const result = await performAction(action, targetId, metadata)

    // Immutable audit entry — always, even if action "failed"
    await auditLog.write({
        actorId: adminId,
        actorSource: adminSource,
        actionType: `admin.${action}`,
        targetId,
        metadata: { ...metadata, result }
    })

    // Notify other admins of high-severity actions
    if (HIGH_SEVERITY_ACTIONS.includes(action)) {
        await notifyOnlineAdmins(adminId, action, targetId)
    }

    return result
}
```

---

## Ban Evidence System

```typescript
interface EvidenceBundle {
    id: string;
    targetIdentifier: string;
    description: string;
    createdBy: string;
    screenshots: string[];    // Object storage URLs
    eventLog: AuditEntry[];   // Last 500 events from target
    riskHistory: RiskEvent[]; // Risk score history
    chatLog: string[];        // Last 100 chat messages
    transactionLog: Transaction[]; // Last 50 transactions
    createdAt: Date;
}
```

Evidence bundles are immutable once created and stored in object storage (S3/MinIO).

---

## Security Configuration Reference

```env
# Event Firewall
ATC_FIREWALL_UNKNOWN_EVENT_LOG=true
ATC_FIREWALL_UNKNOWN_EVENT_KICK_THRESHOLD=10

# Risk Engine
ATC_RISK_AUTO_KICK_THRESHOLD=85
ATC_RISK_AUTO_BAN_THRESHOLD=100
ATC_RISK_NOTIFY_ADMIN_THRESHOLD=60

# Rate Limiting
ATC_RATELIMIT_GLOBAL_WINDOW_MS=60000
ATC_RATELIMIT_GLOBAL_MAX=500

# Economy Guard
ATC_ECONOMY_FRAUD_LARGE_TRANSFER_THRESHOLD=500000
ATC_ECONOMY_FRAUD_RAPID_TRANSFER_COUNT=10
ATC_ECONOMY_FRAUD_RAPID_TRANSFER_WINDOW_MS=60000
```
