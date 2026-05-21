# Module List

## Module Categories

1. **Core Packages** — foundational, no game logic
2. **Service Modules** — API-side business logic
3. **Plugin Modules** — FiveM-side game features
4. **Bridge Modules** — Legacy compatibility adapters
5. **Infrastructure Modules** — Platform utilities

---

## Core Packages

| Package | Path | Purpose | Status |
|---|---|---|---|
| `@atc/core` | `packages/core/` | Shared types, Zod schemas, constants, enums | Phase 0 |
| `@atc/sdk` | `packages/sdk/` | ATC SDK (TS + Lua) — unified API for plugins | Phase 0 |
| `@atc/db` | `packages/db/` | MariaDB client, ORM config, migrations, repositories | Phase 0 |
| `@atc/cache` | `packages/cache/` | Redis abstraction, key builders, pub/sub, TTL policies | Phase 0 |
| `@atc/events` | `packages/events/` | Event bus contracts, typed emitter, event registry | Phase 0 |
| `@atc/security` | `packages/security/` | Zod validation, rate limiter, risk engine, audit logger | Phase 0 |
| `@atc/localization` | `packages/localization/` | i18n resources (en/de/fa), locale helpers | Phase 0 |
| `@atc/ui` | `packages/ui/` | Shared React components, design tokens, RTL utilities | Phase 0 |

---

## Service Modules (API Side)

Each service runs inside `apps/api` as a router module. Services may later be extracted as standalone microservices.

| Service | Router Path | Responsibilities | Depends On |
|---|---|---|---|
| **Player Service** | `/api/v1/players` | Sessions, identity, character data, spawn, disconnect | `@atc/db`, `@atc/cache` |
| **Economy Service** | `/api/v1/economy` | Currency, transfers, transaction log, fraud detection | `@atc/db`, `@atc/cache`, `@atc/security` |
| **Inventory Service** | `/api/v1/inventory` | Items, stashes, containers, weight, hotbar | `@atc/db`, `@atc/cache` |
| **Territory Service** | `/api/v1/territory` | Zones, ownership, capture events, income | `@atc/db`, `@atc/cache`, `@atc/events` |
| **Housing Service** | `/api/v1/housing` | Properties, furniture, keys, rent | `@atc/db`, `@atc/cache` |
| **Vehicle Service** | `/api/v1/vehicles` | Registry, mods, garages, impound, ownership | `@atc/db`, `@atc/cache` |
| **Job Service** | `/api/v1/jobs` | Careers, factions, ranks, duty, payroll | `@atc/db`, `@atc/cache` |
| **Combat Service** | `/api/v1/combat` | Health records, injury states, death log, respawn rules | `@atc/db`, `@atc/events` |
| **Social Service** | `/api/v1/social` | Groups, gangs, friends, faction rosters | `@atc/db`, `@atc/cache` |
| **Dispatch Service** | `/api/v1/dispatch` | Emergency calls, unit assignment, blip management | `@atc/db`, `@atc/events` |
| **Admin Service** | `/api/v1/admin` | Bans, warnings, freeze, kick, evidence, audit log | `@atc/db`, `@atc/security` |
| **Telemetry Service** | `/api/v1/telemetry` | Structured logging, metrics ingestion, error tracking | `@atc/db` |

---

## Plugin Modules (FiveM Side)

Each plugin is an independent FiveM resource that uses `ATC.SDK.*` for all server interactions.

### atc-identity
- Character creation flow
- Appearance customization (ped, clothing)
- Character selection screen
- Multi-character support
- Spawn point selection
- **Events published:** `atc:player:character:selected`, `atc:player:character:created`

### atc-inventory
- Item stacks with metadata
- Player inventory (weight-based)
- Hotbar system
- Stash/container system (vehicles, properties)
- Item use/drop/give actions
- **Events published:** `atc:inventory:item:added`, `atc:inventory:item:removed`, `atc:inventory:item:used`

### atc-economy
- Cash and bank currency
- ATM/bank interactions
- Salary/paycheck system
- Market price feeds
- Transaction UI
- **Events published:** `atc:economy:transaction:completed`, `atc:economy:balance:updated`

### atc-housing
- Property purchase/rent UI
- Door lock/unlock
- Stash access (interior)
- Furniture placement
- Property management menu
- **Events published:** `atc:housing:entered`, `atc:housing:exited`, `atc:housing:door:locked`

### atc-vehicles
- Garage in/out
- Vehicle spawning/despawning
- Mod shop integration
- Vehicle ownership transfer
- Impound mechanics
- **Events published:** `atc:vehicle:spawned`, `atc:vehicle:despawned`, `atc:vehicle:impounded`

### atc-jobs
- Job/career selection
- Duty toggle
- Job-specific blips and tasks
- Rank progression
- Payroll triggers
- **Events published:** `atc:job:duty:started`, `atc:job:duty:ended`, `atc:job:rank:promoted`

### atc-combat
- Health sync (server-authoritative)
- Injury system (limb damage, effects)
- Downed/death state
- Revive mechanics
- Respawn rules
- **Events published:** `atc:combat:player:downed`, `atc:combat:player:died`, `atc:combat:player:revived`

### atc-territory
- Zone boundaries (polygon-based)
- Capture point system
- Ownership visualization (blips, colors)
- Territory income ticks
- Contested zone events
- **Events published:** `atc:territory:contested`, `atc:territory:captured`, `atc:territory:income:paid`

### atc-dispatch
- Emergency call creation
- Unit response tracking
- 911/emergency UI
- Dispatch board (LEO/EMS side)
- Call history
- **Events published:** `atc:dispatch:call:created`, `atc:dispatch:unit:assigned`

### atc-admin
- Admin menu (spectate, teleport, freeze)
- Permission-gated admin actions
- Player search and management
- Evidence bundle creation
- Ban/warning system UI
- **Events published:** `atc:admin:action:executed`, `atc:admin:ban:issued`

---

## Bridge Modules

| Bridge | Target Framework | Intercepts | Status |
|---|---|---|---|
| `qbcore-bridge` | QBCore | `exports['qb-core']`, QB events | Planned |
| `esx-bridge` | ESX Legacy | `ESX.GetPlayerData()`, ESX events | Planned |
| `qbox-bridge` | Qbox | Qbox exports, Qbox events | Planned |
| `ndcore-bridge` | ND Core | ND exports, ND events | Planned |

---

## Infrastructure Modules

| Module | Path | Purpose |
|---|---|---|
| API Server | `apps/api/` | Main HTTP API serving all services |
| Admin Web | `apps/web/` | React-based admin dashboard |
| Docker Compose | `infra/docker/` | Local dev and prod container config |
| DB Migration Runner | `packages/db/migrations/` | Versioned schema migrations |
| Nginx Config | `infra/nginx/` | Reverse proxy, SSL termination |
| Seed Scripts | `infra/scripts/` | Dev data seeding |

---

## Module Dependency Rules

1. `packages/core` → **no ATC dependencies** (pure types/schemas)
2. `packages/sdk` → only `packages/core`
3. `packages/db` → only `packages/core`
4. Service modules → can use any `packages/*`
5. Plugin modules → only `packages/sdk` (Lua), `packages/core` (TS UI)
6. Bridge modules → **zero internal ATC package dependencies** (isolated)
7. `apps/web` → only `packages/ui`, `packages/core`, `packages/localization`
