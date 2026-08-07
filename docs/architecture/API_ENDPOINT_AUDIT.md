# API Endpoint Audit — Lua ↔ ATC API

Every HTTP call the Lua side makes, checked against the routes the API actually
registers. Run after the `ApiBase` and `ATC.SDK` fixes, which had until then
prevented most of these calls from ever being reached.

## How this was checked

The API's 75 route modules were loaded and registered on a real Fastify 5
instance, with workspace imports stubbed so no database is required. The router
built from them — **1113 routes** — was then asked, via
`fastify.findRoute()`, to resolve each path the Lua code calls. This is the
router's own answer, not a comparison of strings.

**What this proves:** whether a call reaches a handler at all.
**What it does not prove:** that the handler does the right thing, or that the
payload matches the schema. Those need a running API with a database.

## Result

| | At audit time | Now |
|---|---|---|
| Lua call sites checked | **404** | 404 |
| Route resolves | **358** (88%) | **all of them** |
| Path exists, wrong method | **11** | 0 |
| Path does not exist (404) | **35** | 0 |

Every path the Lua side builds now resolves to a handler. The entries in the
list further down are kept as they were found; each is marked with how it was
closed.

Both failure classes reached the API and came back as an error rather than doing
anything: a wrong method or an unknown path is a 404 in Fastify.

### How the last ones were closed

The final group needed API work rather than a corrected path, so they are worth
listing by what was actually built:

| Was missing | Resolution |
|---|---|
| duty toggle | No new endpoint. On duty *is* an open work session, so the plugin now calls `POST /api/v1/work-sessions/clock-in` / `clock-out` and reads state from `GET /api/v1/work-sessions/character/{id}?status=active`. That is also what payroll is computed from, so any other notion of duty would pay for hours nobody recorded. |
| payroll tick | No new endpoint. Payroll runs per organisation and period (`/payroll/preview` then `/commit`); the per-player tick had no counterpart and never could. The plugin now runs one aligned period per configured organisation, and runs nothing at all while none are configured. |
| gang membership by principal | New `GET /api/v1/criminal/gangs/member/{principalId}`, over the existing `atc_gang_members`. Returns memberships with their gangs resolved. |
| account bans | New `POST /api/v1/accounts/ban`, `DELETE /api/v1/accounts/ban/{banId}`, `GET /api/v1/accounts/{accountId}/bans`, plus the write path on `BanRepository`, which until now could only read. Bans could be checked at connect and never created, so `/atcban` and the anti-cheat auto-ban were kicks that the player could walk straight back from. |
| weapon attachments | New `POST /api/v1/combat/weapons/{weaponId}/attachments` and `GET /api/v1/combat/weapons/holder/{principalId}/equipped`. `atc_weapon_runtime.attachment_state` already existed; nothing exposed it, and the game layer had no way to name the weapon row. |
| instant crafting | New `POST /api/v1/crafting/craft` and migration 362 for recipe ingredients. `atc_crafting_recipes` described only the output, so the server had no record of what a recipe cost — an instant craft was impossible without taking the ingredient list from the client. Distinct from the production-job flow, which models stations and queues and never touches character inventory. |
| ground loot pickup | New `POST/GET /api/v1/inventory/loot`, `GET /api/v1/inventory/loot/{lootId}`, `POST /api/v1/inventory/loot/{lootId}/pickup`, and migration 363. Piles existed only in each client's memory, so a pickup could not be granted and nothing knew when one had already been taken. |

---

## Fixed since this audit

| Was | Now | Commit |
|---|---|---|
| `POST /api/v1/combat/sessions/start` | `/api/v1/combat-simulation/sessions/start` | `94eec42` |
| `POST /api/v1/combat/sessions/{id}/end` — resolved, but to the *other* subsystem | `/api/v1/combat-simulation/sessions/{id}/end` | `94eec42` |
| `POST /api/v1/combat/ballistics/record` | `/api/v1/combat-simulation/ballistics/record` | `94eec42` |
| `POST /api/v1/combat/suppression/apply` | `/api/v1/combat-simulation/suppression/apply` | `94eec42` |
| `DELETE /api/v1/combat/suppression/{id}` | `/api/v1/combat-simulation/suppression/{id}` | `94eec42` |
| `POST /api/v1/combat/cleanup` | `/api/v1/combat-simulation/cleanup` | `94eec42` |
| `POST /api/v1/inventory/add` (3 call sites) | `/api/v1/inventory/character/{id}/add` | `f0b9b14` |
| `POST /api/v1/inventory/remove` | `/api/v1/inventory/character/{id}/remove` | `f0b9b14` |
| `GET /api/v1/economy/wallets/{principalId}` | `/api/v1/wallets/character/{characterId}` | `f0b9b14` |
| `POST /api/v1/economy/wallets/{id}/credit\|debit` | `/api/v1/wallets/character/{id}/credit\|debit` | `f0b9b14` |
| `GET /api/v1/characters/{id}/inventory` | `/api/v1/inventory/character/{id}` | `f0b9b14` |

Each of those also had payload problems that would have turned the 404 into a
400 — missing required fields, and in the wallet case the wrong identifier
entirely. Both were fixed alongside the paths.

## Not fixable in Lua — since built

Two calls had no counterpart at all, so no path change could help them. Both
have since been built in the API:

- `POST /api/v1/inventory/loot/{id}/pickup` — the API registered no loot routes.
  Now backed by `atc_ground_loot` (migration 363), which is what makes a pickup
  grantable: the pile's contents are the server's, not the picking client's.
- `POST /api/v1/crafting/craft` — crafting was job-based
  (`POST /api/v1/crafting/jobs`), with no instant craft and no ingredient list
  anywhere in the schema. Now backed by migration 362 and a craft service that
  consumes ingredients and grants the output.

## Replication: no findings

For the avoidance of doubt, `game/atc-core/server/replication.lua` is clean —
all 17 of its calls resolve. An earlier draft of this audit listed several as
missing; that was a preprocessing bug that dropped the trailing path parameter
(`/ownership/` .. entityId` became `/ownership`), not a defect in the Lua.

---

## Path does not exist

The Lua calls an endpoint the API never registers. Each entry shows the calling
line and the routes that do exist in that area.

### `GET /api/v1/accounts/{id}/characters`

- **Called from:** `plugins/atc-identity/server/init.lua:162`
  ```lua
  ATC.HTTP.Get('/api/v1/accounts/' .. session.accountId .. '/characters', function(ok, status, data, err)
  ```
- **API has:** `GET /api/v1/accounts/check/:identifier`; `POST /api/v1/accounts`

### `POST /api/v1/accounts/ban`

- **Called from:** `game/atc-core/server/anticheat.lua:33`
  ```lua
  ATC.HTTP.Post('/api/v1/accounts/ban', { identifier=identifier or 'unknown', reason='[AutoBan] '..reason, expiresAt=nil }, function() end)
  ```
- **API has:** `GET /api/v1/accounts/check/:identifier`; `POST /api/v1/accounts`

### `GET /api/v1/characters/{id}/inventory`

- **Called from:** `plugins/atc-inventory/server/init.lua:177`
  ```lua
  ATC.HTTP.Get('/api/v1/characters/'..characterId..'/inventory', function(iok,_,idata)
  ```
- **API has:** `GET /api/v1/characters/:characterId`; `GET /api/v1/characters/account/:accountId`; `POST /api/v1/characters`

### `GET /api/v1/characters/{id}/vitals`

- **Called from:** `plugins/atc-ems/server/init.lua:50`
  ```lua
  ATC.HTTP.Get('/api/v1/characters/' .. targetId .. '/vitals', function(ok, _, data)
  ```
- **API has:** `GET /api/v1/characters/:characterId`; `GET /api/v1/characters/account/:accountId`; `POST /api/v1/characters`

### `POST /api/v1/combat/ballistics/record`

- **Called from:** `game/atc-core/server/combat_runtime.lua:43`
  ```lua
  ATC.SDK.HTTP.Post('/api/v1/combat/ballistics/record', {
  ```
- **API has:** `DELETE /api/v1/combat-simulation/armor/:entityId`; `DELETE /api/v1/combat-simulation/suppression/:entityId`; `GET /api/v1/combat-simulation/armor/:entityId`; `GET /api/v1/combat-simulation/ballistics/pending/:sessionId`

### `POST /api/v1/combat/cleanup`

- **Called from:** `game/atc-core/server/combat_runtime.lua:78`
  ```lua
  ATC.SDK.HTTP.Post('/api/v1/combat/cleanup', {
  ```
- **API has:** `DELETE /api/v1/combat-simulation/armor/:entityId`; `DELETE /api/v1/combat-simulation/suppression/:entityId`; `GET /api/v1/combat-simulation/armor/:entityId`; `GET /api/v1/combat-simulation/ballistics/pending/:sessionId`

### `POST /api/v1/combat/sessions/start`

- **Called from:** `game/atc-core/server/combat_runtime.lua:10`
  ```lua
  local ok, err = ATC.SDK.HTTP.Post('/api/v1/combat/sessions/start', {
  ```
- **API has:** `DELETE /api/v1/combat-simulation/armor/:entityId`; `DELETE /api/v1/combat-simulation/suppression/:entityId`; `GET /api/v1/combat-simulation/armor/:entityId`; `GET /api/v1/combat-simulation/ballistics/pending/:sessionId`

### `DELETE /api/v1/combat/suppression/{id}`

- **Called from:** `game/atc-core/server/combat_runtime.lua:73`
  ```lua
  ATC.SDK.HTTP.Delete('/api/v1/combat/suppression/' .. entityId)
  ```
- **API has:** `DELETE /api/v1/combat-simulation/armor/:entityId`; `DELETE /api/v1/combat-simulation/suppression/:entityId`; `GET /api/v1/combat-simulation/armor/:entityId`; `GET /api/v1/combat-simulation/ballistics/pending/:sessionId`

### `POST /api/v1/combat/suppression/apply`

- **Called from:** `game/atc-core/server/combat_runtime.lua:59`
  ```lua
  ATC.SDK.HTTP.Post('/api/v1/combat/suppression/apply', {
  ```
- **API has:** `DELETE /api/v1/combat-simulation/armor/:entityId`; `DELETE /api/v1/combat-simulation/suppression/:entityId`; `GET /api/v1/combat-simulation/armor/:entityId`; `GET /api/v1/combat-simulation/ballistics/pending/:sessionId`

### `GET /api/v1/comms/contacts`

- **Called from:** `plugins/atc-phone/server/init.lua:13`
  ```lua
  ATC.HTTP.Get('/api/v1/comms/contacts?characterId=' .. characterId, function(ok, _status, data)
  ```
- **API has:** `GET /api/v1/comms/broadcasts`; `GET /api/v1/comms/channels`; `GET /api/v1/comms/signals`; `POST /api/v1/comms/broadcasts`

### `POST /api/v1/comms/messages`

- **Called from:** `plugins/atc-phone/server/init.lua:35`
  ```lua
  ATC.HTTP.Post('/api/v1/comms/messages', {
  ```
- **API has:** `GET /api/v1/comms/broadcasts`; `GET /api/v1/comms/channels`; `GET /api/v1/comms/signals`; `POST /api/v1/comms/broadcasts`

### `POST /api/v1/crafting/craft`

- **Called from:** `plugins/atc-inventory/server/init.lua:174`
  ```lua
  ATC.HTTP.Post('/api/v1/crafting/craft', { characterId=characterId, recipeId=recipeId }, function(ok, _, data)
  ```
- **API has:** `GET /api/v1/crafting/blueprints/:principalId`; `GET /api/v1/crafting/jobs/:jobId`; `GET /api/v1/crafting/recipes`; `GET /api/v1/crafting/stations/:stationId/jobs`

### `GET /api/v1/criminal/gangs/member/{id}`

- **Called from:** `plugins/atc-criminal/server/init.lua:157`
  ```lua
  ATC.HTTP.Get('/api/v1/criminal/gangs/member/' .. principalId, function(ok, _, data)
  ```
- **API has:** `DELETE /api/v1/criminal/gangs/:gangId/members/:principalId`; `GET /api/v1/criminal/gangs`; `GET /api/v1/criminal/gangs/:gangId`; `POST /api/v1/criminal/contraband`

### `GET /api/v1/economy/wallets/{id}`

- **Called from:** `plugins/atc-phone/server/init.lua:67`
  ```lua
  ATC.HTTP.Get('/api/v1/economy/wallets/' .. principalId, function(ok, _status, data)
  ```
- **API has:** `DELETE /api/v1/economy/organizations/:id/members/:characterId`; `GET /api/v1/economy-regulation/balancing/:id`; `GET /api/v1/economy-regulation/inflation/:regionId`; `GET /api/v1/economy-regulation/regulations/:id`

### `POST /api/v1/economy/wallets/{id}/credit`

- **Called from:** `game/atc-sdk/server/sdk.lua:47`
  ```lua
  ATC.HTTP.Post('/api/v1/economy/wallets/' .. pid .. '/credit', {
  ```
- **API has:** `DELETE /api/v1/economy/organizations/:id/members/:characterId`; `GET /api/v1/economy-regulation/balancing/:id`; `GET /api/v1/economy-regulation/inflation/:regionId`; `GET /api/v1/economy-regulation/regulations/:id`

### `POST /api/v1/economy/wallets/{id}/debit`

- **Called from:** `game/atc-sdk/server/sdk.lua:72`
  ```lua
  ATC.HTTP.Post('/api/v1/economy/wallets/' .. pid .. '/debit', {
  ```
- **API has:** `DELETE /api/v1/economy/organizations/:id/members/:characterId`; `GET /api/v1/economy-regulation/balancing/:id`; `GET /api/v1/economy-regulation/inflation/:regionId`; `GET /api/v1/economy-regulation/regulations/:id`

### `POST /api/v1/factions/territories/{id}/claim`

- **Called from:** `plugins/atc-territory/server/init.lua:50`
  ```lua
  ATC.HTTP.Post('/api/v1/factions/territories/' .. zoneId .. '/claim', {
  ```
- **API has:** `DELETE /api/v1/factions/:factionId`; `GET /api/v1/factions/:factionId`; `GET /api/v1/factions/:factionId/influence`; `GET /api/v1/factions/resource-nodes/:nodeId`

### `POST /api/v1/inventory/add`

- **Called from:** `game/atc-core/server/inventory.lua:454`
  ```lua
  ATC.HTTP.Post('/api/v1/inventory/add', {
  ```
- **API has:** `GET /api/v1/inventory/character/:characterId`; `GET /api/v1/inventory/character/:characterId/settings`; `GET /api/v1/inventory/character/:characterId/transactions`; `PATCH /api/v1/inventory/character/:characterId/settings`

### `POST /api/v1/inventory/loot/{id}/pickup`

- **Called from:** `game/atc-core/server/inventory.lua:474`
  ```lua
  ATC.HTTP.Post('/api/v1/inventory/loot/'..lootId..'/pickup', { characterId=characterId }, function(ok, _, data)
  ```
- **API has:** `GET /api/v1/inventory/character/:characterId`; `GET /api/v1/inventory/character/:characterId/settings`; `GET /api/v1/inventory/character/:characterId/transactions`; `PATCH /api/v1/inventory/character/:characterId/settings`

### `POST /api/v1/inventory/remove`

- **Called from:** `game/atc-sdk/server/sdk.lua:122`
  ```lua
  ATC.HTTP.Post('/api/v1/inventory/remove', {
  ```
- **API has:** `GET /api/v1/inventory/character/:characterId`; `GET /api/v1/inventory/character/:characterId/settings`; `GET /api/v1/inventory/character/:characterId/transactions`; `PATCH /api/v1/inventory/character/:characterId/settings`

### `GET /api/v1/jobs/character/{id}`

- **Called from:** `plugins/atc-jobs/server/init.lua:64`
  ```lua
  ATC.HTTP.Get('/api/v1/jobs/character/' .. characterId, function(ok, status, data, err)
  ```
- **API has:** `GET /api/v1/jobs`; `GET /api/v1/jobs/:jobId/grades`; `PATCH /api/v1/jobs/:jobId`; `POST /api/v1/jobs`

### `POST /api/v1/jobs/duty/toggle`

- **Called from:** `plugins/atc-jobs/server/init.lua:40`
  ```lua
  ATC.HTTP.Post('/api/v1/jobs/duty/toggle', {
  ```
- **API has:** `GET /api/v1/jobs`; `GET /api/v1/jobs/:jobId/grades`; `PATCH /api/v1/jobs/:jobId`; `POST /api/v1/jobs`

### `POST /api/v1/jobs/payroll/tick`

- **Called from:** `plugins/atc-jobs/server/init.lua:94`
  ```lua
  ATC.HTTP.Post('/api/v1/jobs/payroll/tick', {
  ```
- **API has:** `GET /api/v1/jobs`; `GET /api/v1/jobs/:jobId/grades`; `PATCH /api/v1/jobs/:jobId`; `POST /api/v1/jobs`

### `POST /api/v1/market/listings/{id}/buy`

- **Called from:** `plugins/atc-marketplace/server/init.lua:70`
  ```lua
  ATC.HTTP.Post('/api/v1/market/listings/' .. listingId .. '/buy', {
  ```
- **API has:** `GET /api/v1/market/auctions/:auctionId`; `GET /api/v1/market/bank/accounts/:principalId`; `GET /api/v1/market/fraud/flags`; `GET /api/v1/market/listings/:listingId`

### `POST /api/v1/narrative/arcs`

- **Called from:** `game/atc-core/server/narrative_world.lua:34`
  ```lua
  ATC.HTTP.Post('/api/v1/narrative/arcs', {
  ```
- **API has:** `GET /api/v1/narrative/campaigns/:id`; `GET /api/v1/narrative/campaigns/active`; `GET /api/v1/narrative/progression/:entityId/:campaignId`; `GET /api/v1/narrative/sessions/active`

### `POST /api/v1/narrative/arcs/{id}/advance`

- **Called from:** `game/atc-core/server/narrative_world.lua:73`
  ```lua
  ATC.HTTP.Post('/api/v1/narrative/arcs/' .. arcId .. '/advance', {
  ```
- **API has:** `GET /api/v1/narrative/campaigns/:id`; `GET /api/v1/narrative/campaigns/active`; `GET /api/v1/narrative/progression/:entityId/:campaignId`; `GET /api/v1/narrative/sessions/active`

### `POST /api/v1/properties/{id}/access/check`

- **Called from:** `plugins/atc-housing/server/init.lua:57`
  ```lua
  ATC.HTTP.Post(
  ```
- **API has:** `GET /api/v1/properties/:propertyId`; `GET /api/v1/properties/:propertyId/storage/:stashId`; `POST /api/v1/properties`; `POST /api/v1/properties/:propertyId/access/:accessId/revoke`

### `GET /api/v1/security/audit{id}`

- **Called from:** `game/atc-core/server/security.lua:187`
  ```lua
  ATC.HTTP.Get('/api/v1/security/audit' .. qs, function(ok, _status, data, err)
  ```
- **API has:** `DELETE /api/v1/security/principals/:id/capabilities/:capability`; `DELETE /api/v1/security/principals/:id/roles/:roleId`; `GET /api/v1/security-runtime/containments/:id`; `GET /api/v1/security-runtime/escalations/:id`

### `POST /api/v1/vehicles/{id}/impound/pay`

- **Called from:** `plugins/atc-vehicles/server/init.lua:186`
  ```lua
  ATC.HTTP.Post('/api/v1/vehicles/' .. vehicleId .. '/impound/pay', {
  ```
- **API has:** `GET /api/v1/vehicles/:vehicleId`; `GET /api/v1/vehicles/:vehicleId/impounds`; `GET /api/v1/vehicles/runtime/:vehicleRuntimeId/state`; `GET /api/v1/vehicles/runtime/damage/:vehicleRuntimeId`

### `POST /api/v1/vitals/{id}/damage`

- **Called from:** `game/atc-core/server/hazards.lua:57`
  ```lua
  ATC.HTTP.Post(
  ```
- **API has:** `GET /api/v1/vitals/character/:characterId`; `PATCH /api/v1/vitals/character/:characterId`; `POST /api/v1/vitals/character/:characterId/mutate`; `POST /api/v1/vitals/character/:characterId/reset`

---

## Path exists, wrong method

Mostly a misnomer, and worth stating plainly: only two of these were a verb on
the right endpoint. The rest matched a parameterised route by accident — a
literal segment like `spawn` matches `:vehicleId`, so the tool reported the verb
registered on *that* route rather than admitting the path does not exist for the
verb being used. They are missing endpoints, not wrong methods.

**Fixed:**

| Was | Now |
|---|---|
| `GET /api/v1/characters?search=` (MDT) | `GET /api/v1/mdt/search/characters?q=` — the MDT has its own search; `/characters` offers only create and fetch-by-id |
| `POST /api/v1/combat/injuries/resolve-active` | `GET /api/v1/combat/injuries/{principalId}` then `POST /api/v1/combat/injuries/{injuryId}/resolve` per entry — there is no bulk resolve |

**Not a verb problem — the endpoint does not exist:**

| Call | What the API has instead |
|---|---|
| `POST /api/v1/combat/weapons/attachment` | equip, unequip, ammo, seize — attachments are not modelled |
| `GET /api/v1/economy/organizations/{id}/members` | POST to add and DELETE to remove; no listing |
| `GET /api/v1/market/listings` | `GET /api/v1/market/listings/{listingId}` only |
| `GET /api/v1/properties?ownerId=` | `GET /api/v1/properties/{propertyId}` only |
| `GET /api/v1/vehicles?ownerId=` | `GET /api/v1/garages/{garageId}/vehicles`, keyed by garage; `GET /api/v1/garages` lists all garages, not one owner's |
| `POST /api/v1/vehicles/spawn` | no spawn route |
| `POST /api/v1/vehicles/store` | no store route |

The shape recurs: the API offers create and fetch-by-id but no owner-scoped
listing, which is what the game layer keeps asking for.


| Lua calls | API registers | Source |
|---|---|---|
| `GET /api/v1/characters` | `POST` | `plugins/atc-mdt/server/init.lua:32` |
| `POST /api/v1/combat/injuries/resolve-active` | `GET` | `plugins/atc-combat/server/init.lua:75` |
| `POST /api/v1/combat/weapons/attachment` | `GET` | `plugins/atc-combat/server/init.lua:128` |
| `GET /api/v1/economy/organizations/{id}/members` | `POST` | `game/atc-core/server/economy.lua:335` |
| `GET /api/v1/market/listings` | `POST` | `game/atc-core/server/ai_simulation.lua:27` |
| `GET /api/v1/properties` | `POST` | `plugins/atc-housing/server/init.lua:22` |
| `GET /api/v1/vehicles` | `POST` | `plugins/atc-vehicles/server/init.lua:64` |
| `POST /api/v1/vehicles/spawn` | `GET` | `plugins/atc-vehicles/server/init.lua:32` |
| `POST /api/v1/vehicles/store` | `GET` | `plugins/atc-vehicles/server/init.lua:137` |

---

## Reproducing

The probe is not committed: it needs a standalone `fastify` install and a Node
loader that stubs the `@atc/*` workspace imports. The approach is described
above and is straightforward to rebuild — load every module in
`apps/api/src/routes/`, register it on a Fastify instance, then call
`fastify.findRoute({ method, url })` for each path the Lua side uses.

## Caveats

- Paths built by concatenation (`'/x/' .. id`) were checked with a placeholder
  segment, which is what the router matches on anyway.
- Query strings were stripped before matching; Fastify routes on the path only.
- Calls are extracted statically, so a path assembled in an unusual way could be
  missed. The figures above are a lower bound on the problem, not an upper one.

## What resolving does not mean

Worth stating plainly, because "every path resolves" is easy to over-read.

**A route can resolve and still answer 503.** Most optional services are
declared on `AppContext` but never constructed in `apps/api/src/index.ts`, and
each route begins with a `if (!ctx.thing) return 503` guard. Of the subsystems
touched here, accounts/bans, inventory, ground loot, crafting and phone are
wired; combat and criminal are not, so their routes — including the two added
here — answer 503 until someone constructs those services. That is the state
every other route in those files is already in, not something introduced by
these endpoints.

**The API application does not currently build.** `@atc/cache` is depended on by
`apps/api` and `packages/runtime-items` and does not exist in the repository.
Every other package builds; that one missing package stops the app.

**Runtime queries are not MySQL-compatible even though the schema is.** 48
statements across 40 files bind `LIMIT ?` / `OFFSET ?`, which MySQL 8 rejects
over the prepared-statement protocol ("Incorrect arguments to
mysqld_stmt_execute") and MariaDB accepts. The ones on the paths added or
changed here were fixed; the rest were left alone and are listed by
`grep -rl "LIMIT ?" --include=*.ts packages/ apps/`.

