# Monorepo Structure

## Build System

- **Monorepo tool:** TurboRepo
- **Package manager:** pnpm with workspaces
- **Node version:** 22.x (LTS)
- **TypeScript:** 5.x strict mode throughout

TurboRepo provides:
- Parallel task execution across packages
- Incremental builds with remote cache
- Dependency-aware pipeline (build order by graph)
- Unified `turbo run build/test/lint` commands

---

## Workspace Layout

```
d:\ATC/
│
├── apps/                          # Deployable applications
│   ├── api/                       # ATC REST API server (Node.js + TypeScript)
│   └── web/                       # ATC Admin Panel (React + Vite)
│
├── packages/                      # Shared internal packages
│   ├── core/                      # Shared types, constants, Zod schemas
│   ├── sdk/                       # ATC SDK (TS library + Lua source)
│   ├── db/                        # Database client, migrations, repositories
│   ├── cache/                     # Redis abstraction layer
│   ├── events/                    # Event bus contracts + emitter
│   ├── security/                  # Validation, rate limiting, risk engine
│   ├── localization/              # i18n packages (en, de, fa)
│   └── ui/                        # Shared React component library
│
├── plugins/                       # First-party ATC plugins (each is a FiveM resource)
│   ├── atc-identity/              # Character creation, appearance
│   ├── atc-inventory/             # Item management, containers
│   ├── atc-economy/               # Currency, transactions, markets
│   ├── atc-housing/               # Property management
│   ├── atc-vehicles/              # Vehicle registry, mods, ownership
│   ├── atc-jobs/                  # Careers, factions, ranks
│   ├── atc-combat/                # Health, injuries, tactical combat
│   ├── atc-territory/             # Zone control, capture points
│   ├── atc-dispatch/              # Emergency dispatch system
│   └── atc-admin/                 # Admin tools, moderation
│
├── bridges/                       # Legacy compatibility adapters
│   ├── qbcore-bridge/             # QBCore API compatibility
│   ├── esx-bridge/                # ESX API compatibility
│   ├── qbox-bridge/               # Qbox API compatibility
│   └── ndcore-bridge/             # ND Core API compatibility
│
├── fivem/                         # FiveM resources
│   ├── [atc]/                     # Core FiveM resource (event bus, SDK host)
│   └── [atc-sdk]/                 # SDK export resource
│
├── infra/                         # Infrastructure configuration
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   ├── web.Dockerfile
│   │   └── docker-compose.yml
│   ├── nginx/
│   │   └── atc.conf
│   └── scripts/
│       ├── setup.sh
│       ├── migrate.sh
│       └── seed.sh
│
├── docs/                          # Documentation
│   └── architecture/              # Phase 0 architecture docs
│       └── ADRs/                  # Architecture Decision Records
│
├── tools/                         # Build utilities and code generators
│   ├── eslint-config/
│   ├── tsconfig/
│   └── generators/                # Plop/Hygen plugin scaffolding templates
│
├── .github/
│   └── workflows/                 # CI/CD pipelines
│
├── turbo.json                     # TurboRepo pipeline config
├── pnpm-workspace.yaml            # pnpm workspace definition
├── package.json                   # Root package (devDependencies only)
├── .gitignore
├── .env.example
├── README.md                      # Project overview
└── CONTRIBUTING.md                # Contribution guide & conventions
```

---

## Package Dependency Graph

```
apps/api          ──depends on──► packages/core
apps/api          ──depends on──► packages/db
apps/api          ──depends on──► packages/cache
apps/api          ──depends on──► packages/events
apps/api          ──depends on──► packages/security
apps/api          ──depends on──► packages/localization

apps/web          ──depends on──► packages/core
apps/web          ──depends on──► packages/ui
apps/web          ──depends on──► packages/localization

plugins/*         ──depends on──► packages/core  (TS side only)
plugins/*         ──depends on──► packages/sdk   (Lua side via fxmanifest)

packages/sdk      ──depends on──► packages/core
packages/db       ──depends on──► packages/core
packages/security ──depends on──► packages/core
packages/cache    ──depends on──► packages/core
packages/events   ──depends on──► packages/core
packages/ui       ──depends on──► packages/core
packages/ui       ──depends on──► packages/localization

bridges/*         ──zero internal ATC package deps (isolated)
```

**Rule:** No circular dependencies. `packages/core` has zero internal deps.

---

## TurboRepo Pipeline

```json
// turbo.json (abbreviated)
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

---

## Key Config Files

### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'plugins/*'
  - 'bridges/*'
  - 'tools/*'
```

### TypeScript Config Hierarchy
```
tools/tsconfig/
├── base.json          # strict, ES2022 target
├── node.json          # extends base, Node types
├── react.json         # extends base, React/DOM types
└── lua-types.json     # FiveM Lua type stubs (future)
```

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Package names | `@atc/{name}` | `@atc/core`, `@atc/sdk` |
| Plugin names | `atc-{name}` | `atc-inventory` |
| Bridge names | `{framework}-bridge` | `qbcore-bridge` |
| FiveM resources | `[atc]`, `[atc-sdk]` | Brackets = ATC namespace |
| App names | short lowercase | `api`, `web` |

---

## Development Commands

```bash
# Install all packages
pnpm install

# Run everything in dev mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint all
pnpm lint

# Run DB migrations
pnpm db:migrate

# Generate a new plugin scaffold
pnpm generate:plugin

# Format code
pnpm format
```
