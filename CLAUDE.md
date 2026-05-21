# ATC — Atlantic Core
## Project Bible for AI Assistance

Atlantic Core (ATC) is a next-generation, modular MMO-style persistent world platform built on FiveM for Atlantic Community. It is **not** a traditional FiveM roleplay framework — it is an enterprise-grade, live-service game platform with MMO architecture.

---

## Critical Rules (Read First)

### ALWAYS
- Use `ATC.SDK.*` for all internal API calls
- Use event names in format `atc:{domain}:{action}` (see `docs/architecture/05-event-standards.md`)
- Use server-side validation for all player inputs
- Use translation keys — never hardcode UI text
- Use UUID v7 for all database primary keys
- Use snake_case for database tables/columns
- Use camelCase for TypeScript, PascalCase for classes/types
- Follow plugin manifest spec when adding a new module
- Check `docs/architecture/` before making architectural decisions

### NEVER
- Trust client-side data or calculations
- Use `exports['qb-core']`, `exports['es_extended']`, or any legacy framework internally
- Hardcode strings in UI components
- Write direct SQL in business logic — use the repository layer
- Add framework coupling inside `packages/` or `plugins/` — bridges only in `bridges/`
- Use `TriggerEvent` (server→server) for cross-service communication — use the Event Bus
- Add polling loops where events can be used
- Expose database connections outside the `packages/db` package

---

## Tech Stack

| Layer | Technology |
|---|---|
| Gameplay Runtime | FiveM, Lua 5.4 |
| API Server | Node.js 22, TypeScript 5.x |
| Admin UI | React 19, Tailwind 4, Framer Motion, Zustand, i18next |
| Primary DB | MariaDB 11.x |
| Cache / State | Redis 7.x |
| Monorepo | TurboRepo, pnpm workspaces |
| Containers | Docker, Docker Compose |
| CI/CD | GitHub Actions |

---

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           FiveM Client (Lua)            │  ← UI NUI, input, rendering
├─────────────────────────────────────────┤
│           ATC SDK (Lua/Client)          │  ← Client-side SDK (read-only state)
├─────────────────────────────────────────┤
│     FiveM Server (Lua) — ATC Core       │  ← Game logic, event handling
├─────────────────────────────────────────┤
│           ATC SDK (Lua/Server)          │  ← Server SDK, service calls
├─────────────────────────────────────────┤
│     ATC API Server (TypeScript)         │  ← REST API, business logic
├─────────────────────────────────────────┤
│  Redis (runtime state)  MariaDB (data)  │  ← Persistence layer
└─────────────────────────────────────────┘
```

---

## Monorepo Layout (Quick Reference)

```
d:\ATC/
├── apps/
│   ├── api/          # Node.js TypeScript REST API
│   └── web/          # React admin panel
├── packages/
│   ├── core/         # Shared types, constants, schemas (Zod)
│   ├── sdk/          # ATC SDK (Lua + TS)
│   ├── db/           # DB client, migrations, repositories
│   ├── cache/        # Redis abstraction
│   ├── events/       # Event bus contracts + emitter
│   ├── security/     # Validation, rate limiting, risk scoring
│   ├── localization/ # i18n packages (en/de/fa)
│   └── ui/           # Shared React components
├── plugins/          # First-party ATC plugins
│   ├── atc-identity/
│   ├── atc-inventory/
│   ├── atc-economy/
│   ├── atc-housing/
│   ├── atc-vehicles/
│   ├── atc-jobs/
│   ├── atc-combat/
│   ├── atc-territory/
│   ├── atc-dispatch/
│   └── atc-admin/
├── bridges/          # Legacy framework adapters (QB, ESX, etc.)
├── fivem/            # FiveM resources
│   ├── [atc]/        # Core FiveM resource
│   └── [atc-sdk]/    # SDK FiveM resource
├── infra/            # Docker, nginx, scripts
└── docs/             # Architecture documentation
    └── architecture/ # All 20 Phase 0 docs
        └── ADRs/     # Architecture Decision Records
```

---

## SDK Usage Pattern

### Lua (Server-side)
```lua
-- Get player data
local player = ATC.SDK.Player.Get(source)
if not player then return end

-- Add inventory item
local success, err = ATC.SDK.Inventory.AddItem(player.id, 'water_bottle', 1, {})

-- Economy transfer
local ok = ATC.SDK.Economy.Transfer(fromId, toId, 500, 'cash', 'shop_purchase')
```

### TypeScript (API)
```typescript
import { ATCPlayer } from '@atc/sdk'

const player = await ATCPlayer.getByIdentifier(identifier)
await ATCPlayer.update(player.id, { health: 100 })
```

---

## Event Standards (Quick Reference)

Pattern: `atc:{domain}:{noun}:{verb}`

```lua
-- Server → Client
TriggerClientEvent('atc:inventory:item:added', source, payload)

-- Client → Server (must be in event whitelist)
TriggerServerEvent('atc:player:request:respawn', payload)

-- Internal (Event Bus, TS side)
EventBus.emit('atc:economy:transaction:completed', payload)
```

---

## Plugin Structure (Minimum)

```
plugins/my-plugin/
├── atc.manifest.json   ← Required
├── fxmanifest.lua      ← FiveM resource manifest
├── server/
│   └── index.lua
├── client/
│   └── index.lua
├── shared/
│   └── config.lua
├── api/               ← Optional: TypeScript API extension
│   └── index.ts
└── ui/                ← Optional: React UI
    └── index.tsx
```

---

## Adding a New Plugin — Checklist

1. Create folder in `plugins/`
2. Write `atc.manifest.json` (id, version, dependencies, permissions)
3. Write `fxmanifest.lua`
4. Use `ATC.SDK.*` for all game interactions
5. Add REST endpoints in `api/` if needed
6. Add UI in `ui/` with i18n keys only
7. Add DB migrations in `packages/db/migrations/`
8. Document events published/subscribed
9. Add plugin to `pnpm-workspace.yaml`

---

## Security Checklist (Every PR)

- [ ] No client-trusted values in server logic
- [ ] Rate limit applied to all server events
- [ ] Input validated with Zod schema
- [ ] Sensitive operations logged to audit log
- [ ] No direct DB access outside repository layer
- [ ] No hardcoded strings or credentials

---

## Key Documentation

| Topic | File |
|---|---|
| Architecture Overview | `docs/architecture/00-overview.md` |
| Monorepo Structure | `docs/architecture/01-monorepo-structure.md` |
| Module List | `docs/architecture/02-module-list.md` |
| Service Boundaries | `docs/architecture/03-service-boundaries.md` |
| Plugin Architecture | `docs/architecture/04-plugin-architecture.md` |
| Event Standards | `docs/architecture/05-event-standards.md` |
| API Standards | `docs/architecture/06-api-standards.md` |
| Database Standards | `docs/architecture/07-database-standards.md` |
| SDK Structure | `docs/architecture/08-sdk-structure.md` |
| Security Architecture | `docs/architecture/09-security-architecture.md` |
| Localization | `docs/architecture/10-localization.md` |
| State Replication | `docs/architecture/11-state-replication.md` |
| Redis Strategy | `docs/architecture/12-redis-strategy.md` |
| Admin System | `docs/architecture/13-admin-system.md` |
| Compatibility Bridges | `docs/architecture/14-compatibility-bridges.md` |
| Dev Standards | `docs/architecture/15-dev-standards.md` |
| CI/CD | `docs/architecture/16-cicd.md` |
| Logging & Telemetry | `docs/architecture/17-logging-telemetry.md` |
| Folder Structure | `docs/architecture/18-folder-structure.md` |
| ADR Index | `docs/architecture/ADRs/README.md` |
