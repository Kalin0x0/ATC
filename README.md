<div align="center">

<img src="docs/branding/atlantic-logo.png" alt="Atlantic Core logo" width="280" />

# Atlantic Core

**A modern, modular world platform for FiveM — by Naiemi Group.**

Atlantic Core (ATC) is what you reach for when a normal roleplay framework
stops being enough. It runs your server like a live game: persistent players,
a real economy, jobs, vehicles, property, crime, emergency services, and a
clean phone/HUD — all backed by a proper API, database, and admin panel
instead of a pile of loosely glued scripts.

Open project · source-available · built to be extended.

<br/>

🌐 **Setup guide in your language — click a code:**

**[🇬🇧 EN](database/README.md#english)**  ·  **[🇮🇷 FA — فارسی](database/README.md#فارسی-farsi)**  ·  **[🇹🇷 TR — Türkçe](database/README.md#türkçe-turkish)**  ·  **[🇪🇸 ES — Español](database/README.md#español-spanish)**  ·  **[🇩🇪 DE — Deutsch](database/README.md#deutsch-german)**

</div>

---

## What is this, really?

Most FiveM servers are built from dozens of community resources that each keep
their own state, talk to the database their own way, and break in their own
way. ATC takes the opposite approach. It treats your server as one platform:

- **One source of truth.** Player data, money, items, vehicles, and jobs live
  behind a single TypeScript API with a real database (MariaDB) and a fast
  runtime cache (Redis). The game never trusts the client for anything that
  matters.
- **Everything is a plugin.** Identity, inventory, economy, housing, vehicles,
  jobs, police, EMS, crime, the phone, the marketplace — each is a self-contained
  module that talks to the core through one SDK. Turn them on and off in your
  `server.cfg`.
- **A real admin panel.** Manage players, sessions, bans, the economy, and
  server operations from a web dashboard, not from chat commands.
- **Made to build on.** Clear SDK, documented events, a plugin guide, and an
  example plugin so you can add your own gameplay without forking the core.

If you run a server, ATC gives you a solid foundation. If you build for FiveM,
it gives you a clean platform to build on.

---

## What's in the box

**For players (in-game UI):** character creation, a smartphone (contacts,
messages, banking, GPS, 911), an inventory with hotbar and drag-and-drop, a
vitals/armor/job HUD, an emote wheel, an interaction system, garages, an ATM,
a marketplace, a police MDT, an EMS panel, and more. Every interface is dark,
modern, and responsive from 720p up to 4K.

**For server owners:** Docker setup for the API + MariaDB + Redis + nginx, an
example `server.cfg`, a web admin panel, optional Prometheus/Grafana monitoring,
backup scripts, and an anti-cheat layer.

**For developers:** a typed monorepo (TurboRepo + pnpm), an SDK for Lua and
TypeScript, a documented event bus, ~80 domain runtime packages, database
migrations, a test suite, and compatibility bridges for QBCore and ESX.

> Want the full picture of every interface? See
> **[docs/screenshots/](docs/screenshots/)** for captured UI shots, and
> **[TODO.txt](TODO.txt)** for the phase-by-phase feature status.

---

## How it fits together

```
   FiveM Client (Lua)            UI, input, rendering (NUI)
        │
   ATC SDK (client)              read-only client state
        │
   ATC Core (Lua server)         game logic, event handling, security
        │
   ATC SDK (server)              service calls
        │
   ATC API (TypeScript)          REST API + business rules (Fastify, Node 22)
        │
   Redis  +  MariaDB             runtime state  +  persistent data
```

The full design — service boundaries, event standards, security model, and the
architecture decision records — lives in
**[docs/architecture/](docs/architecture/)**.

---

## Tech stack

| Layer | Technology |
|---|---|
| Game runtime | FiveM, Lua 5.4 |
| API server | Node.js 22, TypeScript 5, Fastify |
| Admin panel | React 19, Tailwind 4, Vite, Zustand |
| Database | MariaDB 11 |
| Cache / runtime state | Redis 7 |
| Monorepo | TurboRepo + pnpm workspaces |
| Infra | Docker, nginx, HAProxy, Prometheus, Grafana |

---

## Quick start

You'll need Node.js 22+, pnpm 9+, Docker, and a FiveM (FXServer) install.

**1 — Bring up the backend (database, cache, API):**

```bash
cp infra/.env.example infra/.env      # set your DB and Redis passwords
docker compose -f infra/docker-compose.yml up -d
```

**2 — Install and build the monorepo:**

```bash
pnpm install
pnpm turbo build
pnpm turbo test
```

**2b — Set up the database.** Either let the migration runner build it
(`pnpm db:migrate`), or — the simple QBCore/ESX-style way — import the single
schema file **[`database/atc.sql`](database/)** into a fresh `atc` database.
Step-by-step import instructions for Windows in **English, فارسی, Türkçe,
Español, and Deutsch** are in **[database/README.md](database/README.md)**.

**3 — Set up the game server:**

```bash
cp infra/server.cfg.example server.cfg   # fill in your tokens and convars
# Start order in server.cfg: atc-core, atc-sdk, then the plugins you want.
```

The API runs from `apps/api`, and the admin panel from `apps/web`
(`pnpm --filter @atc/web dev`). New to building plugins? Start with
**[docs/sdk/PLUGIN_GUIDE.md](docs/sdk/PLUGIN_GUIDE.md)**.

---

## Repository layout

| Path | What lives here |
|---|---|
| `apps/` | `api` (Fastify REST API) and `web` (React admin panel) |
| `packages/` | Shared libraries and domain runtimes (`db`, `cache`, `events`, `schemas`, `sdk`, `ui`, and the gameplay/system packages) |
| `plugins/` | First-party gameplay plugins (identity, economy, housing, jobs, combat, phone, MDT, EMS, and more) |
| `bridges/` | Compatibility adapters for QBCore and ESX |
| `game/` | FiveM Lua resources: `atc-core` (server/client + NUI) and `atc-sdk` |
| `infra/` | Docker, nginx, HAProxy, monitoring, backup, `server.cfg.example` |
| `database/` | One-file schema (`atc.sql`) + multi-language import guide |
| `docs/` | Architecture, SDK guides, and UI screenshots |
| `tools/` | Shared TS config, lint config, and repo scripts |

---

## Plugins & keybinds

Plugins live in `plugins/` and depend on `atc-core`. The default keys below are
registered with `RegisterKeyMapping`, so players can rebind them in the FiveM
settings menu.

| Plugin | What it does | Default key |
|---|---|---|
| `atc-identity` | Character creation & customization | — |
| `atc-inventory` | Inventory, item use, crafting | F7 craft · TAB inventory\* |
| `atc-economy` | Money, ATM, shops | F5 ATM |
| `atc-housing` | Property ownership, access, locks | F3 |
| `atc-vehicles` | Garage, spawning, impound | F1 |
| `atc-jobs` | Jobs, duty, payroll | F4 menu · F6 duty |
| `atc-combat` | Death, revive, weapon attachments | F10 attachments |
| `atc-territory` | Faction zone control | F2 map |
| `atc-dispatch` | 911 calls and unit routing | — |
| `atc-admin` | In-game staff tools | F6 menu |
| `atc-phone` | Smartphone: contacts, messages, bank, GPS, 911 | NUMPAD0 |
| `atc-mdt` | Police mobile data terminal | F9 · F12 evidence |
| `atc-ems` | Medical gameplay | F10 patient |
| `atc-criminal` | Robberies, drugs, gangs, smuggling | G gang menu |
| `atc-marketplace` | Player-to-player trading | F8 |
| `atc-example-shop` | Reference plugin using the SDK | — |

\* `TAB` inventory, `B` emote wheel, and `F11` activity browser are part of the
core resource. A couple of defaults overlap (F6, F10) when many plugins run at
once — rebind one per pair in your deployment.

---

## Documentation

- **[docs/architecture/](docs/architecture/)** — how ATC is designed
- **[docs/sdk/PLUGIN_GUIDE.md](docs/sdk/PLUGIN_GUIDE.md)** — build your own plugin
- **[docs/sdk/API_REFERENCE.md](docs/sdk/API_REFERENCE.md)** — SDK & API reference
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to contribute
- **[THIRD_PARTY.md](THIRD_PARTY.md)** — third-party software & attribution
- **[docs/funding.md](docs/funding.md)** — support & sponsorship guide

---

## 💜 Support this Project

Atlantic Core is an open, source-available platform built and maintained in the
open by **Naiemi Group**. If ATC powers your server, saves you time, or you'd
simply like to see it grow, please consider supporting its development. Your
support goes straight into new plugins, better docs, and long-term maintenance —
and every contribution, big or small, genuinely means a lot. 🙏

<p align="center">
  <a href="https://github.com/sponsors/Kalin0x0">
    <img src="https://img.shields.io/badge/Sponsor%20on%20GitHub-%E2%9D%A4-EA4AAA?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="Sponsor Atlantic Core on GitHub" />
  </a>
  &nbsp;
  <a href="https://naiemi.com">
    <img src="https://img.shields.io/badge/naiemi.com-Support%20ATC-2EA043?style=for-the-badge" alt="Support Atlantic Core at naiemi.com" />
  </a>
</p>

<p align="center">
  <strong><a href="https://github.com/sponsors/Kalin0x0">❤️ Become a GitHub Sponsor</a></strong>
  &nbsp;·&nbsp;
  <strong><a href="https://naiemi.com">🌐 Other ways to support</a></strong>
</p>

> The repository's **Sponsor** button (top of the page) is powered by
> **[.github/FUNDING.yml](.github/FUNDING.yml)**. More platforms — Ko-fi,
> Buy Me a Coffee, Patreon, Open Collective, and PayPal — can be switched on at
> any time; the step-by-step guide is in **[docs/funding.md](docs/funding.md)**.

<!--
  ┌───────────────────────────────────────────────────────────────────────────┐
  │  READY-TO-USE BADGES                                                       │
  │  Uncomment a line below once you add the matching handle to               │
  │  .github/FUNDING.yml, then replace <handle> with your username.           │
  └───────────────────────────────────────────────────────────────────────────┘

  [![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/<handle>)
  [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-FFDD00?style=for-the-badge&logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/<handle>)
  [![Patreon](https://img.shields.io/badge/Patreon-Become%20a%20patron-FF424D?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/<handle>)
  [![Open Collective](https://img.shields.io/badge/Open%20Collective-Back%20us-7FADF2?style=for-the-badge&logo=opencollective&logoColor=white)](https://opencollective.com/<handle>)
  [![PayPal](https://img.shields.io/badge/PayPal-Donate-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://www.paypal.me/<handle>)
-->

---

## License

Atlantic Core is an open project by **Naiemi Group**, released under the
**Naiemi Group Open Development License** — see **[LICENSE](LICENSE)**.

In plain terms: you can read the code, run it on your own server (commercial
servers included), and modify it however you like. What you can't do is
redistribute it, re-publish it, or clone it into a separate or competing
product. Improvements are welcome back in the main project — see
[CONTRIBUTING.md](CONTRIBUTING.md).

ATC ships no GTA V game assets. Server operators are responsible for licensing
any assets their deployment needs and for following the FiveM / CitizenFX
Platform Agreement.

---

<div align="center">

<img src="docs/branding/atlantic-logo.png" alt="Atlantic" width="120" />

**Atlantic Core** · maintained by Naiemi Group

</div>
