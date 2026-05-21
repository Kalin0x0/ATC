# Plugin Architecture

## Philosophy

Every ATC feature is a plugin. The Core provides the platform; plugins provide the game. Plugins are:

- **Isolated** — no direct imports between plugins
- **Declared** — every dependency is explicit in the manifest
- **Versioned** — semantic versioning, API compatibility checking
- **Permission-gated** — plugins declare what SDK capabilities they need
- **Hot-swap ready** — plugins can be restarted without restarting Core (within constraints)

---

## Plugin Manifest Spec

Every plugin MUST have an `atc.manifest.json` at its root.

```json
{
  "$schema": "https://atc.atlantic-community.de/schemas/plugin-manifest.v1.json",
  "id": "atc-inventory",
  "name": "ATC Inventory",
  "description": "Item management, stashes, and containers for ATC",
  "version": "1.0.0",
  "apiVersion": "1",
  "author": "Atlantic Community",
  "license": "PROPRIETARY",
  "repository": "https://github.com/atlantic-community/atc",

  "dependencies": {
    "atc-core": "^1.0.0",
    "atc-identity": "^1.0.0"
  },

  "optionalDependencies": {
    "atc-housing": "^1.0.0"
  },

  "permissions": [
    "inventory.read",
    "inventory.write",
    "economy.read",
    "player.read"
  ],

  "entryPoints": {
    "server": "server/index.lua",
    "client": "client/index.lua",
    "shared": "shared/config.lua",
    "api": "api/index.ts",
    "ui": "ui/index.tsx"
  },

  "events": {
    "publishes": [
      "atc:inventory:item:added",
      "atc:inventory:item:removed",
      "atc:inventory:item:used"
    ],
    "subscribes": [
      "atc:player:disconnected",
      "atc:housing:exited"
    ]
  },

  "config": {
    "maxWeight": 30,
    "hotbarSlots": 5
  },

  "migrations": [
    "migrations/001_initial.sql"
  ]
}
```

---

## Manifest Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Unique kebab-case identifier |
| `name` | string | ✅ | Human-readable display name |
| `version` | semver | ✅ | Plugin version |
| `apiVersion` | string | ✅ | ATC Core API version required |
| `dependencies` | object | ✅ | Required plugin deps (semver ranges) |
| `optionalDependencies` | object | ❌ | Optional deps (feature-gates) |
| `permissions` | array | ✅ | SDK permissions required |
| `entryPoints.server` | string | ✅ | Server Lua entry |
| `entryPoints.client` | string | ❌ | Client Lua entry (if needed) |
| `entryPoints.api` | string | ❌ | TypeScript API extension (if needed) |
| `entryPoints.ui` | string | ❌ | React NUI entry (if needed) |
| `events.publishes` | array | ❌ | Events this plugin emits |
| `events.subscribes` | array | ❌ | Events this plugin listens to |
| `config` | object | ❌ | Default config values |
| `migrations` | array | ❌ | SQL migration files in order |

---

## Plugin Directory Structure

```
plugins/atc-inventory/
├── atc.manifest.json           ← Required — plugin declaration
├── fxmanifest.lua              ← FiveM resource manifest
│
├── server/                     ← Server-side Lua
│   ├── index.lua               ← Entry point (loaded first)
│   ├── commands.lua            ← Server command registrations
│   ├── events.lua              ← Server event handlers
│   └── handlers/               ← Action handlers
│       ├── add_item.lua
│       ├── remove_item.lua
│       └── use_item.lua
│
├── client/                     ← Client-side Lua
│   ├── index.lua               ← Entry point
│   ├── nui.lua                 ← NUI bridge
│   └── keybinds.lua            ← Input handling
│
├── shared/                     ← Shared Lua (loaded on both sides)
│   ├── config.lua              ← Plugin configuration
│   └── constants.lua           ← Shared constants
│
├── api/                        ← TypeScript API extension (optional)
│   ├── index.ts                ← Router entry
│   ├── routes/
│   │   ├── inventory.routes.ts
│   │   └── stash.routes.ts
│   ├── services/
│   │   └── inventory.service.ts
│   └── repositories/
│       └── inventory.repo.ts
│
├── ui/                         ← React NUI (optional)
│   ├── index.tsx               ← NUI root
│   ├── components/
│   │   ├── InventoryGrid.tsx
│   │   ├── ItemSlot.tsx
│   │   └── Hotbar.tsx
│   ├── hooks/
│   │   └── useInventory.ts
│   └── store/
│       └── inventory.store.ts
│
├── migrations/                 ← SQL migration files
│   ├── 001_initial.sql
│   └── 002_add_metadata.sql
│
├── locales/                    ← Translation overrides (optional)
│   ├── en.json
│   ├── de.json
│   └── fa.json
│
└── package.json                ← If plugin has TS/React components
```

---

## Plugin Lifecycle

```
Bootstrap Order:
1. ATC Core starts and registers Plugin Registry
2. Core scans all resource directories for atc.manifest.json
3. Core resolves dependency graph (topological sort)
4. Core validates permissions against Plugin Permission Registry
5. Core starts plugins in dependency order
6. Each plugin registers events with the Event Bus
7. Plugin fires 'atc:plugin:ready' on successful start

Per-plugin Start Sequence:
1. fxmanifest.lua loads shared/config.lua
2. Server-side index.lua is executed
3. Plugin calls ATC.Core.RegisterPlugin(manifest)
4. ATC Core validates API version compatibility
5. ATC Core grants declared permissions
6. Plugin registers its event handlers
7. Plugin initialization logic runs
8. 'atc:plugin:ready:{pluginId}' is emitted
```

---

## Permission System

Permissions follow a `{domain}.{action}` pattern:

```
Player permissions:
  player.read          - Read player/character data
  player.write         - Modify player/character data
  player.kick          - Kick a player (admin-only)
  player.ban           - Ban a player (admin-only)

Inventory permissions:
  inventory.read       - Read inventory/stash contents
  inventory.write      - Add/remove/move items
  inventory.admin      - Bypass weight/stack limits

Economy permissions:
  economy.read         - Read balances and transactions
  economy.write        - Create transactions
  economy.admin        - Override limits, issue funds

Territory permissions:
  territory.read       - Read zone data
  territory.write      - Modify ownership/capture state

Admin permissions:
  admin.spectate       - Spectate players
  admin.teleport       - Teleport self/others
  admin.noclip         - No-clip mode
  admin.god            - God mode
  admin.audit          - Read audit logs
  admin.ban            - Issue bans
  admin.evidence       - Create evidence bundles
```

Plugins that request permissions beyond what they need will fail validation at startup.

---

## Hot-Swap Protocol

```
Conditions for safe hot-swap:
  ✅ Plugin has no in-flight transactions
  ✅ No players are in plugin-owned UIs
  ✅ Plugin's Redis keys can be safely abandoned (TTL-based)
  ✅ Plugin does not own shared database write locks

Hot-swap sequence:
1. Admin issues: /atc plugin reload {pluginId}
2. Core drains in-flight requests (5s grace period)
3. Core unregisters plugin event handlers
4. Core invalidates plugin's Redis cache keys
5. FiveM resource restarts: restart {pluginId}
6. Plugin re-registers (normal bootstrap)
7. Core re-grants permissions
```

---

## Plugin Communication Rules

```lua
-- CORRECT: Use Event Bus (no direct plugin reference)
TriggerEvent('atc:economy:request:transfer', {
    from = sourceCharId,
    to = targetCharId,
    amount = 500,
    currency = 'cash',
    reason = 'item_purchase'
})

-- WRONG: Direct export call to another plugin
local economy = exports['atc-economy']
economy:Transfer(...)  -- Never do this between plugins

-- CORRECT: Use SDK (which routes through Core)
local ok = ATC.SDK.Economy.Transfer(fromId, toId, 500, 'cash', 'item_purchase')
```

---

## Third-Party Plugin Standards

Third-party plugins (not by Atlantic Community) must:

1. Use the `tpp-{name}` prefix (not `atc-{name}`)
2. Follow the same manifest spec
3. Only use documented SDK methods (no private API)
4. Pass ATC Plugin Validator before distribution
5. Declare all permissions — requesting `admin.*` requires justification review

Third-party plugins are isolated from ATC internals and communicate only through the public SDK surface.
