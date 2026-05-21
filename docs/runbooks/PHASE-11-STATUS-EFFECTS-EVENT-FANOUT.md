# Phase 11 — Status Effects & Event Fanout Foundation

## Overview

Phase 11 adds a server-authoritative, Redis-backed status effect system and an optional EventBus Redis pub/sub bridge for cross-process event fanout.

Status effects are read-only on the client. All mutation (apply/clear) is strictly server-side.

---

## Status Effect Domain Model

| Field       | Type                            | Notes                                      |
|-------------|---------------------------------|--------------------------------------------|
| `id`        | `string`                        | Deterministic: `status:{characterId}:{type}` |
| `characterId` | `string`                      | ULID of the character                      |
| `type`      | `AtcStatusEffectType`           | `fatigue \| dehydrated \| starving \| stressed \| injured \| custom` |
| `severity`  | `AtcStatusEffectSeverity`       | `low \| medium \| high \| critical`        |
| `source`    | `AtcStatusEffectSource`         | `vitals \| item \| system \| admin`        |
| `reason`    | `string`                        | 3–128 chars, human-readable description    |
| `startedAt` | ISO 8601 string                 | When effect was applied                    |
| `expiresAt` | ISO 8601 string or `null`       | `null` = persistent until explicitly cleared |
| `metadata`  | `Record<string, unknown>?`      | Optional, max 20 keys                      |

---

## Redis Storage Model

Effects are stored in a Redis Hash per character:

```
Key:   atc:status:character:{characterId}
Field: {type}
Value: JSON-serialized AtcStatusEffect
```

- Rolling 86 400-second TTL is refreshed on every write.
- Expired effects (checked via `expiresAt` in-memory) are pruned lazily on `list()` reads.
- Redis failures on `list()` return `[]` (safe empty — non-fatal).
- `StatusEffectCache.apply()` is an upsert: same type replaces the existing effect.

**Effect key uniqueness:** `status:{characterId}:{type}` — one effect per type per character.

---

## Expiry Behaviour

- Effects with `expiresAt: null` are **permanent** until explicitly cleared via DELETE endpoint or by the vitals threshold evaluator.
- Effects with an `expiresAt` timestamp are pruned from the hash on the next `list()` read after expiry. They are **not** evicted via a Redis TTL (only the hash-level rolling TTL keeps the key alive).
- `durationSeconds` (1–86 400) can be set on POST to compute `expiresAt`.

---

## Vitals Threshold Rules

The evaluator is registered on `atc:vitals:changed` at API startup via `registerVitalsThresholdEvaluator()`.

| Effect Type  | Vital    | Apply When     | Clear When       | Severity |
|--------------|----------|----------------|------------------|----------|
| `starving`   | hunger   | `< 20`         | `>= 25`          | `high`   |
| `dehydrated` | thirst   | `< 20`         | `>= 25`          | `high`   |
| `fatigue`    | stamina  | `< 20`         | `>= 30`          | `medium` |
| `stressed`   | stress   | `> 80`         | `<= 70`          | `high`   |

- The band between apply and clear thresholds is **hysteresis** — effects don't thrash on the boundary.
- Vitals-applied effects always have `expiresAt: null` — they clear on vital recovery, not timeout.
- Evaluator errors are caught and logged as `warn` — non-fatal.

---

## EventBus Redis Bridge

The `AtcRedisEventBridge` is an **optional** additive layer over the in-process `AtcEventBus`.

### Enabling

Set environment variable:
```
ATC_EVENTBUS_REDIS_ENABLED=true
```

### Channel Format

```
atc:events:{eventName}
```

e.g., `atc:events:atc:vitals:changed`, `atc:events:atc:status:changed`

### Behaviour

- Uses a **duplicated** Redis connection for the subscriber (pub/sub requires dedicated connection).
- `publish()` is non-fatal — Redis failures are swallowed silently.
- Malformed JSON on the subscriber side is ignored.
- `close()` quits only the subscriber connection; the publisher shares the main Redis connection.
- `close()` is idempotent.

### In-process EventBus is always preserved

The bridge is purely additive. Removing `ATC_EVENTBUS_REDIS_ENABLED` returns to single-process mode without code changes.

---

## API Endpoints

All endpoints require the `Authorization: Bearer {ATC_API_TOKEN}` header.

### GET `/api/v1/status-effects/character/:characterId`

Returns active status effects for a character.

**Responses:**
- `200` — `{ characterId, effects: AtcStatusEffect[] }` (may be empty)
- `400` — Invalid `characterId` param
- `403` — Character is not active
- `404` — Character not found
- `503` — Redis unavailable

### POST `/api/v1/status-effects/character/:characterId`

Applies (or replaces) a status effect. Emits `atc:status:changed`.

**Body:** `ApplyStatusEffectRequest` — `{ type, severity, source, reason, durationSeconds?, metadata? }`

**Responses:**
- `200` — The applied `AtcStatusEffect` object
- `400` — Validation failed
- `403` — Character not active
- `404` — Character not found
- `503` — Redis unavailable

### DELETE `/api/v1/status-effects/character/:characterId/:type`

Clears one effect by type. Emits `atc:status:changed`.

**Responses:**
- `204` — Cleared (or was never set — idempotent)
- `400` — Invalid `type` param
- `403` — Character not active
- `404` — Character not found
- `503` — Redis unavailable

### DELETE `/api/v1/status-effects/character/:characterId`

Clears all effects for a character. Emits `atc:status:changed`.

**Responses:**
- `204` — All cleared
- `403` — Character not active
- `404` — Character not found
- `503` — Redis unavailable

---

## FiveM Event Flow

```
Client                  FiveM Server            API
  |                         |                     |
  |── atc:status:request ──►|                     |
  |                         |── GET /status-eff ─►|
  |                         |◄── effects ─────────|
  |◄── atc:status:update ───|                     |
```

- `ATC.StatusEffects.Get(source, cb)` — fetches effects via HTTP, non-blocking
- `ATC.StatusEffects.Apply(source, effect, cb)` — server-only, POST via HTTP
- `ATC.StatusEffects.Clear(source, type, cb)` — server-only, DELETE via HTTP
- `ATC.StatusEffects.Sync(source)` — pushes current effects to client (called after character select)
- Client rate-limited to 10 reads per 60 seconds via `ATC.Firewall.On`
- Client can never apply or clear effects

---

## Configuration

| Env Var                         | Default | Notes                                  |
|---------------------------------|---------|----------------------------------------|
| `ATC_EVENTBUS_REDIS_ENABLED`    | `false` | Enable Redis pub/sub bridge            |

---

## Event Constants

| Constant                 | Value                   | Direction          |
|--------------------------|-------------------------|--------------------|
| `ATC.Events.STATUS.REQUEST` | `atc:status:request` | client → server    |
| `ATC.Events.STATUS.UPDATE`  | `atc:status:update`  | server → client    |
| `ATC.Events.STATUS.CHANGED` | `atc:status:changed` | server → plugins   |

---

## Manual Test Checklist

1. **Apply an effect via API**
   ```
   POST /api/v1/status-effects/character/{CHAR_ID}
   { "type": "fatigue", "severity": "medium", "source": "admin", "reason": "Manual test" }
   ```
   → 200 with effect object

2. **List effects**
   ```
   GET /api/v1/status-effects/character/{CHAR_ID}
   ```
   → 200 with `effects` array containing the applied effect

3. **Apply same type again (upsert)**
   - POST with `severity: "critical"` for same type
   - List again — should see only one effect with updated severity

4. **Apply with durationSeconds**
   - POST with `durationSeconds: 5`
   - Wait 5+ seconds, GET again — effect should be absent (pruned on read)

5. **Vitals threshold evaluator**
   - Mutate hunger to 10 via `PATCH /api/v1/vitals/character/{id}`
   - List status effects — `starving` should appear with `source: "vitals"`
   - Mutate hunger back to 50 — `starving` should be cleared on next list

6. **FiveM client request**
   - In-game: `TriggerServerEvent('atc:status:request')`
   - Server should fire `atc:status:update` back to client with current effects

7. **Redis bridge (if enabled)**
   - Set `ATC_EVENTBUS_REDIS_ENABLED=true` and restart
   - Apply an effect — check Redis `SUBSCRIBE atc:events:atc:status:changed` receives the message

---

## Known Limitations

- No persistent DB storage for status effects. Effects survive only while the Redis key is alive (86 400s TTL). If Redis is wiped, all effects are lost. DB persistence is deferred to a future phase if needed.
- The vitals threshold evaluator has no hysteresis timer — it fires on every `atc:vitals:changed` event. High-frequency vitals changes (sub-second) will call `apply`/`clear` rapidly. The cache is fast but this is worth monitoring.
- `atc:status:changed` is a server-internal event (not exposed to clients). Plugins subscribe via EventBus only.
