# ATC SDK — Public API Reference

Complete reference for all public ATC SDK APIs available to plugin authors.
Organized by execution context (server / client) and sub-system.

---

## Server-Side APIs

All server APIs are available as globals on the `ATC` table inside any resource
that declares `dependency 'atc-core'` in its `fxmanifest.lua`.

---

### ATC.SDK (facade)

The unified façade exposed via `game/atc-sdk`. Prefer named sub-modules below for
direct access; ATC.SDK re-exports all of them for convenience.

```lua
ATC.SDK                      -- top-level SDK table (server context)
```

---

### ATC.Sessions

Player session lifecycle management.

```lua
ATC.Sessions.Get(source)
```
Returns the full session table for the connected player, or `nil` if no active session.

**Session table fields:**

| Field         | Type   | Description                            |
|---------------|--------|----------------------------------------|
| `source`      | number | FiveM server ID                        |
| `sessionId`   | string | UUID v7 session identifier             |
| `characterId` | string | UUID v7 of the active character        |
| `principalId` | string | Player principal (license/discord)     |
| `createdAt`   | number | Unix ms timestamp                      |

```lua
ATC.Sessions.GetCharacterId(source)
```
Returns the active character UUID for `source`, or `nil`.

```lua
ATC.Sessions.GetAll()
```
Returns a table of all active sessions indexed by server source.

---

### ATC.Accounts

Principal / account resolution.

```lua
ATC.Accounts.GetPrincipalId(source)
```
Returns the player's principal identifier string (e.g. `license:abc123` or
`discord:123456789`), or `nil` if not resolvable.

```lua
ATC.Accounts.GetCharacterId(source)
```
Returns the active character UUID, equivalent to `ATC.Sessions.GetCharacterId(source)`.

---

### ATC.HTTP

Authenticated HTTP client for the ATC REST API. All callbacks receive
`(data, statusCode)` where `data` is the decoded JSON response table.

```lua
ATC.HTTP.Get(path, callback)
ATC.HTTP.Post(path, body, callback)
ATC.HTTP.Patch(path, body, callback)
ATC.HTTP.Delete(path, callback)
```

**Parameters:**

| Parameter  | Type     | Description                                               |
|------------|----------|-----------------------------------------------------------|
| `path`     | string   | API path, e.g. `'/api/v1/players/'..charId`              |
| `body`     | table    | Request body; serialized to JSON automatically            |
| `callback` | function | `function(data, statusCode)` — invoked on completion      |

**Example:**

```lua
ATC.HTTP.Post('/api/v1/inventory/add', {
    characterId = charId,
    itemName    = 'water_bottle',
    quantity    = 1,
    metadata    = {},
}, function(data, status)
    if status == 200 then
        ATC.Log.Info('my-plugin', 'Item added', data)
    end
end)
```

---

### ATC.Economy

Direct economy operations that require a character UUID.

```lua
ATC.Economy.Credit(characterId, amount, currency, reason, callback)
```
Add `amount` of `currency` (`'cash'` or `'bank'`) to the character's wallet.
Callback: `function(ok, walletData)`.

```lua
ATC.Economy.Debit(characterId, amount, currency, reason, callback)
```
Remove `amount` from the character's wallet. Returns `ok = false` if insufficient funds.
Callback: `function(ok, walletData)`.

```lua
ATC.Economy.Transfer(fromCharacterId, toCharacterId, amount, currency, reason, callback)
```
Atomically move `amount` between two character wallets.
Callback: `function(ok)`.

**Currency values:** `'cash'` | `'bank'`

---

### ATC.EconomyPlugin

Convenience wrappers that accept a server source instead of a character UUID.
Resolves `characterId` and `principalId` internally.

```lua
ATC.EconomyPlugin.Pay(source, amount, reason, callback)
```
Credit the player's cash wallet. Equivalent to `ATC.Economy.Credit` with
automatic character resolution.
Callback: `function(ok, walletData)`.

```lua
ATC.EconomyPlugin.Charge(source, amount, reason, callback)
```
Debit the player's cash wallet. Returns `ok = false` on insufficient funds.
Callback: `function(ok, walletData)`.

**walletData table fields:**

| Field  | Type   | Description             |
|--------|--------|-------------------------|
| `cash` | number | Current cash balance    |
| `bank` | number | Current bank balance    |

---

### ATC.Firewall

Event firewall with session validation and rate limiting. Every server event
that accepts client input MUST be registered through this API.

```lua
ATC.Firewall.On(eventName, options, handler)
```

**Options table:**

| Field           | Type    | Default | Description                                              |
|-----------------|---------|---------|----------------------------------------------------------|
| `clientAllowed` | boolean | `false` | Whether clients may trigger this event                   |
| `requireSession`| boolean | `true`  | Reject source if no active ATC session exists            |
| `rateLimit`     | table   | `nil`   | `{ window = <ms>, max = <count> }`                       |
| `minCooldown`   | number  | `nil`   | Per-player hard cooldown in milliseconds                 |
| `adminOnly`     | boolean | `false` | Restrict to players with ATC admin permission            |

**Handler signature:** `function(source, payload)`

Violations are automatically logged to `ATC.Log.Security` and increment the
player's risk score.

---

### ATC.Log

Structured logging to ATC telemetry pipeline. All calls are no-ops on
disabled log levels.

```lua
ATC.Log.Info    (domain, message, context)
ATC.Log.Warn    (domain, message, context)
ATC.Log.Error   (domain, message, context)
ATC.Log.Security(domain, message, context)
ATC.Log.Debug   (domain, message, context)  -- only when ATC.Config.Debug = true
```

**Parameters:**

| Parameter | Type   | Description                                             |
|-----------|--------|---------------------------------------------------------|
| `domain`  | string | Plugin/module identifier, e.g. `'atc-example-shop'`    |
| `message` | string | Human-readable message                                  |
| `context` | table  | Additional structured key-value data (optional)         |

---

### ATC.Vitals

Server-side vitals management.

```lua
ATC.Vitals.Sync(source)
```
Push the latest server-authoritative vitals for `source` to that client.
Called after any operation that modifies health, hunger, or thirst.

---

### ATC.StatusEffects

Server-side status effects management.

```lua
ATC.StatusEffects.Sync(source)
```
Push active status effects for `source` to that client.

---

## Client-Side APIs

Available inside `client_scripts` of any resource that depends on `atc-core`.

---

### ATC.SDK.Player

```lua
ATC.SDK.Player.IsReady()
```
Returns `true` when the ATC client SDK is fully initialized and character data is loaded.

```lua
ATC.SDK.Player.GetCharacter()
```
Returns the character table (mirrors server session `character` sub-table), or `nil`.

```lua
ATC.SDK.Player.GetSessionId()
```
Returns the active session UUID, or `nil`.

---

### ATC.SDK.Vitals

```lua
ATC.SDK.Vitals.Get()
```
Returns `{ health, hunger, thirst, stress }` — all values `0.0–100.0`.

```lua
ATC.SDK.Vitals.GetHealth()   -- number 0.0–100.0
ATC.SDK.Vitals.GetHunger()   -- number 0.0–100.0
ATC.SDK.Vitals.GetThirst()   -- number 0.0–100.0
```

---

### ATC.SDK.Inventory

```lua
ATC.SDK.Inventory.Get()
```
Returns the full inventory array. Each entry: `{ itemName, quantity, metadata }`.

```lua
ATC.SDK.Inventory.HasItem(itemName)
```
Returns `true` if the player has at least one of `itemName` in their inventory.

---

### ATC.SDK.Economy

```lua
ATC.SDK.Economy.GetWallet()  -- { cash = number, bank = number }
ATC.SDK.Economy.GetCash()    -- number
ATC.SDK.Economy.GetBank()    -- number
```

---

### ATC.SDK.Jobs

```lua
ATC.SDK.Jobs.GetActive()
```
Returns the active job table `{ id, name, grade, label }`, or `nil`.

```lua
ATC.SDK.Jobs.IsOnDuty()
```
Returns `true` if the player is currently clocked in.

---

### ATC.SDK.Combat

```lua
ATC.SDK.Combat.IsDead()
```
Returns `true` if the player is in a downed / dead state.

---

### ATC.SDK.Vehicles

```lua
ATC.SDK.Vehicles.IsInVehicle()
```
Returns `true` if the player is currently in a vehicle.

```lua
ATC.SDK.Vehicles.GetState()
```
Returns the vehicle state table `{ netId, model, plate, locked, engine, fuel }`,
or `nil` if not in a vehicle.

---

### ATC.Interaction

Proximity interaction zone and entity prompt system.

```lua
ATC.Interaction.RegisterZone(id, coords, radius, label, onInteractCallback)
```
Register a named 3D zone. When the player enters `radius` meters of `coords`
an interaction prompt labeled `label` appears. `onInteractCallback` fires when
the player presses the interact key (`E` by default).

**Parameters:**

| Parameter           | Type     | Description                                       |
|---------------------|----------|---------------------------------------------------|
| `id`                | string   | Unique zone identifier (per-plugin namespace)     |
| `coords`            | vector3  | World-space center coordinates                    |
| `radius`            | number   | Activation radius in meters                       |
| `label`             | string   | Prompt text displayed to the player               |
| `onInteractCallback`| function | Called when the player activates the prompt       |

```lua
ATC.Interaction.RegisterEntity(id, entityHandle, label, onInteractCallback)
```
Same as `RegisterZone` but attached to a world entity. The zone tracks the
entity as it moves.

```lua
ATC.Interaction.Remove(id)
```
Remove a previously registered zone or entity prompt by `id`.

---

### ATC.Emotes

```lua
ATC.Emotes.Play(emoteId)
```
Play the named emote on the local player ped.

```lua
ATC.Emotes.Stop()
```
Stop any currently playing emote.

```lua
ATC.Emotes.IsPlaying()
```
Returns `true` if an emote is currently active.

---

### ATC.Voice

Proximity voice channel management.

```lua
ATC.Voice.JoinChannel(channelName, options)
```
Join a named voice channel. `options` table: `{ key = <key hash> }` — optional
push-to-talk key override.

```lua
ATC.Voice.LeaveChannel(channelName)
```
Leave the named voice channel.

```lua
ATC.Voice.IsTalking()
```
Returns `true` if the local player is currently transmitting on any active channel.

---

## exports['atc-sdk']

For resources that cannot list `atc-core` as a Lua dependency (e.g. legacy resources,
external plugins loaded independently), the SDK surface is also available as FiveM exports.

### Server exports

```lua
local sdk = exports['atc-sdk']

sdk:GetCharacterId(source)   -- string UUID or nil
sdk:GetSession(source)       -- session table or nil
sdk:GetPrincipalId(source)   -- principal string or nil
```

### Client exports

```lua
local sdk = exports['atc-sdk']

sdk:GetCharacter()   -- character table or nil
sdk:GetSessionId()   -- UUID string or nil
sdk:GetWallet()      -- { cash, bank } or nil
sdk:IsReady()        -- boolean
```

---

## Error Handling Conventions

All async callbacks follow `function(ok, data)` or `function(data, statusCode)`.

```lua
-- Economy callbacks
ATC.EconomyPlugin.Charge(src, 100, 'shop', function(ok, wallet)
    if not ok then
        -- 'ok' is false on insufficient funds or session error
        return
    end
    -- 'wallet' is { cash = number, bank = number }
end)

-- HTTP callbacks
ATC.HTTP.Get('/api/v1/players/'..id, function(data, status)
    if status ~= 200 then
        ATC.Log.Error('my-plugin', 'HTTP error', { status = status })
        return
    end
    -- 'data' is decoded JSON
end)
```

---

## Version Compatibility

| ATC Version | SDK Notes                                          |
|-------------|----------------------------------------------------|
| 0.1.x       | All APIs in this document are stable               |
| future      | Breaking changes announced via ADR and CHANGELOG   |

Plugin authors should declare `"atcMinVersion": "0.1.0"` in their manifest
and pin to the minimum version that provides the APIs they require.
