# ATC — Atlantic Core

> Enterprise-grade, modular **MMO-style persistent-world platform** built on FiveM for the Atlantic Community.

Atlantic Core (ATC) is not a traditional FiveM roleplay framework — it is a live-service game platform with MMO architecture. The gameplay runtime is written in **Lua 5.4** (FiveM), backed by a **TypeScript** business-logic API (Node.js 22, Fastify), **MariaDB 11** for persistence and **Redis 7** for runtime state, with a **React 19** admin panel. Everything is organized as a TurboRepo + pnpm monorepo so that game logic, services, and tooling share a single, type-safe source of truth.

<!-- Badges are placeholders until CI/registry endpoints are wired up. Replace OWNER/REPO. -->
[![Build](https://img.shields.io/badge/build-pending-lightgrey)](#)
[![License](https://img.shields.io/badge/license-Proprietary-red)](#license)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933)](#)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-f69220)](#)

---

## Architecture

ATC is layered: FiveM client (NUI/Lua) → Lua SDK → FiveM server (game logic) → server SDK → TypeScript API → Redis + MariaDB.

See the full design in **[docs/architecture/00-overview.md](docs/architecture/00-overview.md)** (20 Phase-0 architecture documents plus ADRs).

```
┌─────────────────────────────────────────┐
│           FiveM Client (Lua)            │  NUI, input, rendering
├─────────────────────────────────────────┤
│           ATC SDK (Lua / Client)        │  read-only client state
├─────────────────────────────────────────┤
│     FiveM Server (Lua) — ATC Core       │  game logic, event handling
├─────────────────────────────────────────┤
│           ATC SDK (Lua / Server)        │  service calls
├─────────────────────────────────────────┤
│     ATC API Server (TypeScript)         │  REST API, business logic
├─────────────────────────────────────────┤
│  Redis (runtime state)  MariaDB (data)  │  persistence layer
└─────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js **>= 22**, pnpm **>= 9**
- Docker + Docker Compose (for MariaDB, Redis, nginx)
- A FiveM (FXServer) installation for the game layer

### 1. Bring up infrastructure (MariaDB + Redis + nginx)

```bash
cp infra/.env.example infra/.env          # set DB/Redis passwords
docker compose -f infra/docker-compose.yml up -d
# Dev variant (no nginx, API on :3000):  infra/docker-compose.dev.yml
# Monitoring (Prometheus/Grafana):       infra/monitoring/docker-compose.monitoring.yml
# Scaled (HAProxy):                       infra/docker-compose.scaled.yml
```

### 2. Install, build, and test the monorepo

```bash
pnpm install
pnpm turbo build      # or: pnpm build
pnpm turbo test       # or: pnpm test
pnpm db:migrate       # apply database migrations (@atc/db)
```

### 3. Configure and run the game layer

```bash
cp infra/server.cfg.example server.cfg    # adjust resource paths / convars
# Ensure the FXServer resource list starts: game/atc-sdk, game/atc-core, then plugins/*
```

The TypeScript API server runs from `apps/api` (`pnpm --filter @atc/api start`), and the React admin panel from `apps/web` (`pnpm --filter @atc/web dev`).

---

## Repository Layout

| Path | Contents |
|---|---|
| `apps/` | `api` (Node.js + Fastify REST API) and `web` (React 19 admin panel) |
| `packages/` | Shared domain runtimes & libraries: `db`, `cache`, `events`, `schemas`, `shared-types`, `sdk`, `telemetry`, `ui`, plus the gameplay/system runtime packages |
| `plugins/` | First-party ATC gameplay plugins (see [Plugins](#plugins)) |
| `bridges/` | Legacy framework adapters — `qb-core`, `esx` (compatibility only) |
| `game/` | FiveM Lua resources: `atc-core` (server/client game logic + NUI) and `atc-sdk` (Lua SDK) |
| `infra/` | Docker Compose, nginx, HAProxy, monitoring, `server.cfg.example`, `.env.example` |
| `docs/` | Architecture docs (`architecture/`, including ADRs) and SDK docs (`sdk/`) |
| `tools/` | Shared `tsconfig`, `eslint-config`, and repo scripts |

---

## Feature Matrix

The complete, phase-by-phase feature status (done / partial / not done) is tracked in **[TODO.txt](TODO.txt)**. The core runtime (Phases 1–80) is complete; gameplay-UX phases (81+) are documented there with honest `[x]` / `[~]` / `[ ]` markers.

---

## Plugins

First-party plugins live in `plugins/` and depend on `atc-core`. All game interactions go through `ATC.SDK.*`. Keybinds below are the in-repo defaults registered via `RegisterKeyMapping` and are **rebindable** by players in the FiveM settings menu.

| Plugin | Description | Default keybind |
|---|---|---|
| `atc-identity` | Character creation and customization | — |
| `atc-inventory` | Item-use effects and inventory management (crafting UI) | **F7** crafting · **TAB** inventory* |
| `atc-economy` | Money handling, ATM, shop integration | **F5** ATM |
| `atc-housing` | Property ownership, access control, lock management | **F3** housing |
| `atc-vehicles` | Vehicle spawning, garage management, impound | **F1** garage |
| `atc-jobs` | Job assignment, duty toggling, payroll tick | **F4** job menu · **F6** duty |
| `atc-combat` | Death, revive, respawn, EMS dispatch bridge | **F10** weapon attachments |
| `atc-territory` | Faction zone control, capture, broadcast | **F2** territory map |
| `atc-dispatch` | 911 calls, internal dispatch routing, LEO notifications | — |
| `atc-admin` | In-game admin commands (kick, ban, bring, goto, freeze, spectate) | **F6** admin menu |
| `atc-phone` | In-game smartphone: contacts, messaging, calls, banking, GPS | **NUMPAD0** phone |
| `atc-mdt` | Mobile Data Terminal for police / emergency services | **F9** MDT · **F12** collect evidence |
| `atc-ems` | EMS medical gameplay | **F10** check patient |
| `atc-criminal` | Criminal gameplay — robberies, drugs, territory | **G** gang menu |
| `atc-marketplace` | Player-to-player marketplace and trading | **F8** marketplace |
| `atc-example-shop` | Reference implementation: NPC shop using the ATC SDK (MIT) | — |

\* `TAB` inventory, **B** emote wheel, **F11** activity browser, and number-key hotbar are registered in `game/atc-core` (the core resource), not in a plugin.

> Note on keybind collisions: `atc-jobs` duty and `atc-admin` menu both default to **F6**, and `atc-combat` weapon-mods and `atc-ems` check both default to **F10**. Rebind one of each pair per deployment if both plugins are enabled simultaneously.

---

## Documentation

- **[THIRD_PARTY.md](THIRD_PARTY.md)** — third-party dependency & attribution notice
- **[docs/sdk/PLUGIN_GUIDE.md](docs/sdk/PLUGIN_GUIDE.md)** — building ATC plugins
- **[docs/sdk/API_REFERENCE.md](docs/sdk/API_REFERENCE.md)** — SDK / API reference
- **[docs/architecture/00-overview.md](docs/architecture/00-overview.md)** — architecture overview

---

## License

**Proprietary / All rights reserved** (placeholder).

> The repository ships no explicit `LICENSE` file yet. The intended license above is a placeholder — **confirm the final license with the project owner before any public distribution.** The `atc-example-shop` plugin declares MIT in its own manifest.

---

## Attribution

All first-party ATC code is original work. Third-party software that ATC bundles or recommends — and a notice that **no GTA V game assets are shipped** — is documented in **[THIRD_PARTY.md](THIRD_PARTY.md)**.
