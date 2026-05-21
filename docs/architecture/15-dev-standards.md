# Development Standards

## Code Style

### TypeScript

- **Strict mode** everywhere (`"strict": true` in tsconfig)
- No `any` — use `unknown` and narrow
- No `@ts-ignore` — fix the type issue
- Prefer `const` over `let`; no `var`
- Always handle Promise rejections (no floating promises)
- Use Zod for all runtime validation (not manual `typeof` checks)
- Named exports only — no default exports (easier refactoring)
- File names: `kebab-case.ts` for modules, `PascalCase.ts` for classes if standalone
- Type names: `PascalCase` for interfaces/types, `SCREAMING_SNAKE_CASE` for constants

```typescript
// CORRECT
export const MAX_INVENTORY_WEIGHT = 30
export interface InventoryItem { ... }
export type CurrencyType = 'cash' | 'bank'
export function addItem(...): Promise<void> { ... }

// WRONG
export default function addItem(...) { ... }  // no default exports
const x: any = ...                            // no any
```

### Lua

- **Lua 5.4** (FiveM uses Lua 5.4 on cfx runtime)
- Local variables by default — avoid globals
- Prefix all globals with `ATC.` (no raw globals like `ESX`)
- Use `local function` for private, module-level functions
- Use `return {}` pattern for modules
- camelCase for variables and functions
- PascalCase for "classes" (metatables)
- SCREAMING_SNAKE_CASE for constants

```lua
-- CORRECT: Module pattern
local M = {}

local function _privateHelper(x)
    return x * 2
end

function M.PublicFunction(source)
    local result = _privateHelper(source)
    return result
end

return M

-- WRONG: Raw globals
function GivePlayerItem(source, item)  -- pollutes global scope
    ...
end
```

---

## Naming Standards

| Thing | Convention | Example |
|---|---|---|
| TS files | `kebab-case.ts` | `inventory-service.ts` |
| TS classes | `PascalCase` | `InventoryService` |
| TS interfaces | `PascalCase` | `InventoryItem` |
| TS functions | `camelCase` | `addItem()` |
| TS constants | `SCREAMING_SNAKE_CASE` | `MAX_WEIGHT` |
| Lua modules | `PascalCase` | `ATC.SDK.Inventory` |
| Lua functions | `camelCase` | `addItem()` |
| Lua constants | `SCREAMING_SNAKE_CASE` | `MAX_SLOT_COUNT` |
| DB tables | `snake_case` plural | `inventory_items` |
| DB columns | `snake_case` | `character_id` |
| Event names | `atc:{domain}:{noun}:{verb}` | `atc:inventory:item:added` |
| API endpoints | `/api/v{n}/{resource}` | `/api/v1/inventory/{id}` |
| Redis keys | `atc:{service}:{type}:{id}` | `atc:inventory:player:{id}` |
| Environment vars | `SCREAMING_SNAKE_CASE` | `DB_HOST`, `REDIS_PORT` |

---

## Git Workflow

### Branch Strategy

```
main           ← Production-ready code only
develop        ← Integration branch (all features merge here first)
feature/{name} ← New feature work
fix/{name}     ← Bug fixes
hotfix/{name}  ← Critical production fixes (branches from main)
chore/{name}   ← Maintenance, dependency updates, tooling
docs/{name}    ← Documentation only
```

### Commit Message Format

Follows [Conventional Commits](https://conventionalcommits.org/):

```
{type}({scope}): {short description}

{optional body}

{optional footer}
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`

Scopes: plugin name, package name, or `core`, `api`, `web`, `db`, `security`

Examples:
```
feat(atc-inventory): add hotbar slot persistence across sessions

fix(economy-service): prevent race condition in concurrent transfer validation

perf(redis): add write-through cache for balance updates

chore(deps): upgrade ioredis to 5.3.2

docs(architecture): add Redis cluster upgrade guide

feat(qbcore-bridge): translate QB gang functions to ATC social SDK
```

---

## Pull Request Process

### PR Requirements

Every PR must have:
- [ ] Linked issue or description of why this change is needed
- [ ] All TypeScript checks pass (`pnpm typecheck`)
- [ ] All linting passes (`pnpm lint`)
- [ ] All tests pass (`pnpm test`)
- [ ] No new `any` types introduced
- [ ] No hardcoded strings (use translation keys)
- [ ] No direct DB access outside repository layer
- [ ] Security checklist reviewed (see CLAUDE.md)
- [ ] If new DB table: migration file included

### PR Size Targets

- Ideal: < 400 lines changed
- Acceptable: < 800 lines
- Large (requires justification in PR body): 800+
- Should be split: 1500+

### Review Requirements

- 1 approval for `fix`, `chore`, `docs`
- 2 approvals for `feat`, `perf`, `refactor` changes to core packages
- Superadmin approval for security-related changes

---

## Testing Standards

### Test Types

| Type | Tool | What to Test |
|---|---|---|
| Unit | Vitest | Pure business logic, validators, utils |
| Integration | Vitest + real DB | Repository layer, service layer |
| API | Supertest | REST endpoints end-to-end |
| Lua | busted | SDK functions, bridge translation logic |

### Coverage Requirements

| Package | Minimum Coverage |
|---|---|
| `packages/security` | 90% |
| `packages/db` (repos) | 80% |
| `apps/api` (services) | 75% |
| `plugins/*` | 60% |
| `bridges/*` | 70% |

### Test File Naming

```
src/
├── inventory.service.ts
└── inventory.service.test.ts    ← co-located unit test

tests/
└── integration/
    └── inventory.integration.test.ts
```

### Test Patterns

```typescript
// Unit test — no I/O
describe('InventoryService', () => {
    describe('addItem', () => {
        it('throws when weight would exceed limit', async () => {
            const repo = mockInventoryRepo({ currentWeight: 29.5 })
            const service = new InventoryService(repo)

            await expect(
                service.addItem(charId, 'heavy_item', 1)
            ).rejects.toThrow(ATCBusinessRuleError)
        })
    })
})
```

---

## Code Review Checklist

### Security
- [ ] No client-trusted data used server-side
- [ ] Rate limiting applied to new server events
- [ ] New events added to firewall whitelist if needed
- [ ] Zod validation applied to all external inputs
- [ ] Sensitive actions logged to audit log

### Performance
- [ ] No N+1 queries (use batch/join)
- [ ] No SELECT * in production code
- [ ] Redis cache used for hot-path reads
- [ ] Cache invalidated on writes

### Architecture
- [ ] No cross-plugin direct imports
- [ ] Uses SDK for all game interactions
- [ ] Business logic in service layer, not routes
- [ ] Repository layer for all DB access

### Code Quality
- [ ] No `any` types
- [ ] Functions < 40 lines (prefer smaller)
- [ ] Files < 300 lines (prefer smaller)
- [ ] No hardcoded strings
- [ ] Error paths handled

---

## Environment Configuration

All secrets and configuration are environment variables. Never hardcode:

```env
# Required
DB_HOST=localhost
DB_PORT=3306
DB_NAME=atc
DB_USER=atc_api
DB_PASSWORD=

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

ATC_SERVER_TOKEN=          # FiveM → API auth token (rotate daily in prod)
ATC_API_URL=http://localhost:3001

NODE_ENV=development

# Optional
LOG_LEVEL=info             # debug|info|warn|error
LOG_FORMAT=pretty          # pretty|json (use json in prod)
RISK_AUTO_BAN_THRESHOLD=100
```

`.env` is git-ignored. `.env.example` is committed with blank secret values.
