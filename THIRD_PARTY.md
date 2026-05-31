# Third-Party Software & Attribution

All first-party ATC code (`apps/`, `packages/`, `plugins/`, `game/`, `bridges/`) is original work. This file lists third-party software that ATC depends on or recommends.

Versions reflect the ranges declared in the repository's `package.json` files at the time of writing. Licenses are the commonly published licenses for each project; where a license can change between major versions, an entry is marked **(verify before production)**. Always confirm against the upstream `LICENSE` file shipped in `node_modules` / the project repository before distribution.

---

## A. Bundled Runtime Dependencies

Installed into the dependency tree via pnpm and shipped as part of the ATC API server and/or React admin panel.

| Package | Version (declared) | Purpose | License | Source |
|---|---|---|---|---|
| `fastify` | ^5 | HTTP server (REST API) | MIT | https://github.com/fastify/fastify |
| `pino` | ^9 | Structured logging | MIT | https://github.com/pinojs/pino |
| `mysql2` | ^3 | MariaDB / MySQL driver | MIT | https://github.com/sidorares/node-mysql2 |
| `ioredis` | ^5 | Redis client | MIT | https://github.com/redis/ioredis |
| `ulidx` | ^2 | ULID identifier generation | MIT | https://github.com/perry-mitchell/ulidx |
| `zod` | ^3 | Schema validation | MIT | https://github.com/colinhacks/zod |
| `react` | ^19 | UI library (admin panel) | MIT | https://github.com/facebook/react |
| `react-dom` | ^19 | React DOM renderer | MIT | https://github.com/facebook/react |
| `react-router-dom` | ^6 | Client-side routing | MIT | https://github.com/remix-run/react-router |
| `zustand` | ^5 | State management | MIT | https://github.com/pmndrs/zustand |
| `i18next` | ^23 | Internationalization core | MIT | https://github.com/i18next/i18next |
| `react-i18next` | ^14 | React bindings for i18next | MIT | https://github.com/i18next/react-i18next |

---

## B. Build & Infrastructure Tooling

Development, build, and runtime infrastructure. Build tools are not shipped in the production application bundle; infrastructure images are pulled at deploy time and run as separate containers (not redistributed by ATC).

### Build / dev dependencies

| Package | Version (declared) | Purpose | License | Source |
|---|---|---|---|---|
| `typescript` | ^5 | TypeScript compiler / language | Apache-2.0 | https://github.com/microsoft/TypeScript |
| `turbo` (TurboRepo) | ^2 | Monorepo task runner | MIT | https://github.com/vercel/turborepo |
| `vite` | ^6 | Frontend build tool / dev server | MIT | https://github.com/vitejs/vite |
| `@vitejs/plugin-react` | ^4 | React plugin for Vite | MIT | https://github.com/vitejs/vite-plugin-react |
| `@tailwindcss/vite` | ^4 | Tailwind Vite integration | MIT | https://github.com/tailwindlabs/tailwindcss |
| `tailwindcss` | ^4 | CSS framework | MIT | https://github.com/tailwindlabs/tailwindcss |
| `vitest` | ^2 | Test runner | MIT | https://github.com/vitest-dev/vitest |
| `prettier` | ^3 | Code formatter | MIT | https://github.com/prettier/prettier |
| `plop` | ^4 | Code/file generator (scaffolding) | MIT | https://github.com/plopjs/plop |

### Infrastructure container images (pulled at deploy, not redistributed)

| Image | Tag (declared) | Purpose | License | Source |
|---|---|---|---|---|
| `mariadb` | 11 | Primary relational database | GPL-2.0 | https://github.com/MariaDB/server |
| `redis` | 7-alpine | Cache / runtime state | BSD-3-Clause (Redis 7.x; **verify before production** — Redis ≥7.4 uses RSALv2/SSPLv1) | https://github.com/redis/redis |
| `nginx` | alpine | Reverse proxy / static hosting | BSD-2-Clause | https://github.com/nginx/nginx |
| `haproxy` | 2.8-alpine | Load balancer (scaled topology) | GPL-2.0 / LGPL-2.1 | https://github.com/haproxy/haproxy |
| `prom/prometheus` | latest | Metrics collection | Apache-2.0 | https://github.com/prometheus/prometheus |
| `grafana/grafana` | latest | Metrics dashboards | AGPL-3.0 (Grafana ≥ 8.0; **verify before production**) | https://github.com/grafana/grafana |
| `prom/node-exporter` | latest | Host metrics exporter | Apache-2.0 | https://github.com/prometheus/node_exporter |
| Docker / Docker Compose | — | Container runtime / orchestration | Apache-2.0 | https://github.com/docker |

> Database server license note: MariaDB **Server** is GPL-2.0; the bundled JavaScript driver `mysql2` (Section A) is MIT and is what ATC links against. ATC does not redistribute the MariaDB, Redis, nginx, HAProxy, Prometheus, or Grafana binaries — it references official images.

---

## C. Recommended Optional External FiveM Resources (NOT bundled)

These are **operator-supplied** community resources that an operator may add to cover asset- or platform-dependent gaps. They are **not included** in this repository, are **not** a dependency of ATC, and must be obtained and licensed directly from their upstream sources by the operator.

| Resource | Purpose | License | Source | Status |
|---|---|---|---|---|
| `pma-voice` | Proximity voice & radio | MIT | https://github.com/AvarianKnight/pma-voice | Not bundled — operator-supplied |
| `mumble-voip` | Voice transport (built into FXServer) | CitizenFX (part of FXServer) | https://github.com/citizenfx/fivem | Not bundled — ships with FXServer |

### Asset-licensing honesty note (voice / MLO / clothing / peds)

- **Voice:** ATC ships no voice resource. `mumble-voip` is provided by FXServer itself; `pma-voice` (MIT) is the common community add-on layered on top. Operators choose and install one.
- **MLO / interiors and ped / face customization:** ATC intentionally bundles **no** MLO interiors, map streams, clothing packs, or ped assets. These require operator-licensed map/clothing assets (e.g., authored or processed with CodeWalker tooling) and are excluded for licensing reasons. Face/ped customization tooling depends on these operator-supplied assets.

---

## D. Asset Notice

**ATC ships NO GTA V game assets.** The repository contains **no** copyrighted Rockstar/Take-Two map files, vehicle models, ped/clothing assets, audio, textures, or other proprietary game content. ATC is original code (Lua, TypeScript, React, SQL) plus the third-party software libraries listed above.

Operators are solely responsible for supplying and licensing any GTA V game assets, map/MLO streams, clothing, peds, and audio required by their deployment, and for complying with the FiveM/CitizenFX Platform Agreement and Rockstar/Take-Two terms.

---

## How to Add an External Resource

1. Drop the resource folder into your server's `resources/` directory (it is **not** committed to this repo).
2. Add `start <resource-name>` to your `server.cfg` (see `infra/server.cfg.example`), respecting load order relative to `atc-sdk` and `atc-core`.
3. Document it here — add a row to **Section C** with the resource name, purpose, real upstream source, and its actual license, and mark it "operator-supplied, not bundled".
