# Annotated Folder Structure

Complete reference for where everything lives in ATC.

```
d:\ATC/
│
├── CLAUDE.md                          # Project bible — read first
├── package.json                       # Root workspace (devDependencies only)
├── pnpm-workspace.yaml                # pnpm workspace config
├── turbo.json                         # TurboRepo pipeline config
├── .gitignore
├── .env.example                       # Example env vars (no secrets)
├── .eslintrc.js                       # Root ESLint config
├── .prettierrc                        # Prettier config
│
├── apps/                              # ─── DEPLOYABLE APPLICATIONS ───
│   │
│   ├── api/                           # ATC REST API server
│   │   ├── src/
│   │   │   ├── index.ts               # App entry point, server setup
│   │   │   ├── routes/                # Route registration per domain
│   │   │   │   ├── player.routes.ts
│   │   │   │   ├── inventory.routes.ts
│   │   │   │   ├── economy.routes.ts
│   │   │   │   ├── territory.routes.ts
│   │   │   │   ├── housing.routes.ts
│   │   │   │   ├── vehicle.routes.ts
│   │   │   │   ├── admin.routes.ts
│   │   │   │   └── telemetry.routes.ts
│   │   │   ├── services/              # Business logic per domain
│   │   │   │   ├── player.service.ts
│   │   │   │   ├── inventory.service.ts
│   │   │   │   ├── economy.service.ts
│   │   │   │   └── ...
│   │   │   ├── middleware/            # Auth, rate limiting, error handling
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── ratelimit.middleware.ts
│   │   │   │   └── error.middleware.ts
│   │   │   └── plugins/              # Fastify plugins (health, cors, etc.)
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   ├── Dockerfile                # → symlink to infra/docker/api.Dockerfile
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                          # ATC Admin Panel (React)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app.tsx
│       │   ├── i18n.ts
│       │   ├── pages/               # Admin panel pages
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Players.tsx
│       │   │   ├── BanManagement.tsx
│       │   │   ├── EconomyMonitor.tsx
│       │   │   └── AuditLog.tsx
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── store/               # Zustand stores
│       │   └── api/                 # API client (react-query)
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── package.json
│
├── packages/                         # ─── SHARED INTERNAL PACKAGES ───
│   │
│   ├── core/                         # @atc/core — shared types, schemas, constants
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/               # All TypeScript types
│   │   │   │   ├── player.types.ts
│   │   │   │   ├── inventory.types.ts
│   │   │   │   ├── economy.types.ts
│   │   │   │   └── ...
│   │   │   ├── schemas/             # Zod validation schemas
│   │   │   │   ├── player.schemas.ts
│   │   │   │   ├── inventory.schemas.ts
│   │   │   │   └── ...
│   │   │   ├── constants/           # Enums, config constants
│   │   │   │   ├── currency.constants.ts
│   │   │   │   └── limits.constants.ts
│   │   │   └── utils/               # Pure utility functions
│   │   │       ├── id.utils.ts      # UUID v7 generation
│   │   │       └── format.utils.ts
│   │   └── package.json
│   │
│   ├── sdk/                          # @atc/sdk — ATC SDK (TS + Lua)
│   │   ├── lua/
│   │   │   └── ATC/
│   │   │       ├── SDK.lua
│   │   │       ├── Core.lua
│   │   │       ├── Player.lua
│   │   │       ├── Inventory.lua
│   │   │       ├── Economy.lua
│   │   │       ├── Vehicle.lua
│   │   │       ├── Housing.lua
│   │   │       ├── Territory.lua
│   │   │       ├── Dispatch.lua
│   │   │       ├── Admin.lua
│   │   │       └── _http.lua        # Internal HTTP client
│   │   ├── typescript/
│   │   │   └── src/
│   │   │       ├── index.ts
│   │   │       ├── player.ts
│   │   │       └── ...
│   │   └── package.json
│   │
│   ├── db/                           # @atc/db — database client + repositories
│   │   ├── src/
│   │   │   ├── client.ts            # MariaDB connection pool
│   │   │   └── repositories/
│   │   │       ├── player.repo.ts
│   │   │       ├── inventory.repo.ts
│   │   │       ├── economy.repo.ts
│   │   │       └── ...
│   │   ├── migrations/              # SQL migration files (numbered)
│   │   │   ├── 001_initial_schema.sql
│   │   │   └── ...
│   │   └── package.json
│   │
│   ├── cache/                        # @atc/cache — Redis abstraction
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── keys.ts              # Key builder functions
│   │   │   ├── patterns/
│   │   │   │   ├── cache-aside.ts
│   │   │   │   └── write-through.ts
│   │   │   └── pubsub.ts            # Pub/Sub helpers
│   │   └── package.json
│   │
│   ├── events/                       # @atc/events — Event bus
│   │   ├── src/
│   │   │   ├── event-bus.ts         # EventEmitter + Redis pub/sub
│   │   │   ├── registry.ts          # Event registry (all known events)
│   │   │   └── types.ts             # Event payload types
│   │   └── package.json
│   │
│   ├── security/                     # @atc/security — security utilities
│   │   ├── src/
│   │   │   ├── rate-limiter.ts
│   │   │   ├── risk-engine.ts
│   │   │   ├── audit-logger.ts
│   │   │   ├── economy-guard.ts
│   │   │   ├── inventory-guard.ts
│   │   │   └── schemas/             # Validation schemas for client events
│   │   └── package.json
│   │
│   ├── localization/                 # @atc/localization — i18n
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── loader.ts
│   │   │   └── rtl.ts
│   │   ├── locales/
│   │   │   ├── en/
│   │   │   │   ├── core.json
│   │   │   │   ├── inventory.json
│   │   │   │   ├── economy.json
│   │   │   │   └── ...
│   │   │   ├── de/
│   │   │   └── fa/
│   │   └── package.json
│   │
│   └── ui/                           # @atc/ui — shared React components
│       ├── src/
│       │   ├── index.ts
│       │   ├── components/
│       │   │   ├── Button/
│       │   │   ├── Modal/
│       │   │   ├── DataTable/
│       │   │   ├── Badge/
│       │   │   └── ...
│       │   └── styles/
│       │       ├── globals.css
│       │       └── rtl.css
│       └── package.json
│
├── plugins/                          # ─── FIRST-PARTY FIVEM PLUGINS ───
│   │                                 # Each is an independent FiveM resource
│   ├── atc-identity/
│   │   ├── atc.manifest.json        # Plugin manifest (REQUIRED)
│   │   ├── fxmanifest.lua
│   │   ├── server/
│   │   ├── client/
│   │   ├── shared/
│   │   ├── api/                     # TypeScript API extension
│   │   ├── ui/                      # React NUI
│   │   ├── migrations/
│   │   └── locales/
│   │
│   ├── atc-inventory/               # Same structure as atc-identity
│   ├── atc-economy/
│   ├── atc-housing/
│   ├── atc-vehicles/
│   ├── atc-jobs/
│   ├── atc-combat/
│   ├── atc-territory/
│   ├── atc-dispatch/
│   └── atc-admin/
│
├── bridges/                          # ─── LEGACY COMPATIBILITY ADAPTERS ───
│   ├── qbcore-bridge/
│   │   ├── fxmanifest.lua
│   │   ├── server/
│   │   │   ├── index.lua
│   │   │   ├── player.lua
│   │   │   ├── inventory.lua
│   │   │   ├── economy.lua
│   │   │   └── events.lua
│   │   ├── client/
│   │   └── shared/
│   ├── esx-bridge/                  # Same structure
│   ├── qbox-bridge/
│   └── ndcore-bridge/
│
├── fivem/                            # ─── CORE FIVEM RESOURCES ───
│   │
│   ├── [atc]/                       # Core resource (event bus, firewall, session)
│   │   ├── fxmanifest.lua
│   │   ├── server/
│   │   │   ├── index.lua            # Entry point
│   │   │   ├── connection.lua       # Player connection/disconnect
│   │   │   ├── firewall.lua         # Event firewall
│   │   │   ├── session.lua          # Session management
│   │   │   ├── event_bus.lua        # Server-side Event Bus
│   │   │   └── redis_sub.lua        # Redis pub/sub subscriber
│   │   ├── client/
│   │   │   └── index.lua            # Client-side ATC entry
│   │   └── shared/
│   │       └── config.lua
│   │
│   └── [atc-sdk]/                   # SDK resource (shared_scripts for all plugins)
│       ├── fxmanifest.lua
│       └── ATC/                     # → symlink to packages/sdk/lua/ATC/
│
├── infra/                            # ─── INFRASTRUCTURE ───
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   ├── web.Dockerfile
│   │   └── docker-compose.yml
│   ├── nginx/
│   │   └── atc.conf
│   └── scripts/
│       ├── setup.sh                 # First-time setup
│       ├── migrate.sh               # Run DB migrations
│       ├── seed.sh                  # Dev data seeding
│       ├── rotate-server-token.sh   # Rotate API auth token
│       └── rollback-api.sh          # Blue-green rollback
│
├── tools/                            # ─── BUILD TOOLS ───
│   ├── eslint-config/               # Shared ESLint rules
│   ├── tsconfig/                    # Shared TypeScript configs
│   │   ├── base.json
│   │   ├── node.json
│   │   └── react.json
│   └── generators/                  # Plop plugin scaffolding templates
│       ├── plopfile.js
│       └── templates/
│           ├── plugin/
│           └── service/
│
├── .github/
│   └── workflows/
│       ├── pr.yml                   # PR validation
│       ├── build.yml                # Docker build + push
│       └── security.yml             # Dependency security scan
│
└── docs/
    └── architecture/
        ├── 00-overview.md
        ├── 01-monorepo-structure.md
        ├── 02-module-list.md
        ├── 03-service-boundaries.md
        ├── 04-plugin-architecture.md
        ├── 05-event-standards.md
        ├── 06-api-standards.md
        ├── 07-database-standards.md
        ├── 08-sdk-structure.md
        ├── 09-security-architecture.md
        ├── 10-localization.md
        ├── 11-state-replication.md
        ├── 12-redis-strategy.md
        ├── 13-admin-system.md
        ├── 14-compatibility-bridges.md
        ├── 15-dev-standards.md
        ├── 16-cicd.md
        ├── 17-logging-telemetry.md
        ├── 18-folder-structure.md    ← THIS FILE
        └── ADRs/
            ├── README.md
            ├── ADR-001-monorepo-turborepo.md
            ├── ADR-002-rest-api-over-tcp.md
            ├── ADR-003-redis-runtime-state.md
            ├── ADR-004-plugin-manifest-system.md
            └── ADR-005-server-authoritative-model.md
```
