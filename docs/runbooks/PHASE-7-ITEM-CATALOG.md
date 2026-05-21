# Phase 7 — Item Definition Management & Admin Catalog

## Overview

Phase 7 extends the item definition system with admin-grade CRUD, bulk operations, metadata validation, and a server-side Lua item cache. Item definitions are the authoritative catalog of every item type that can exist in the game.

**Critical constraints:**
- Item definitions are **never physically deleted** — only disabled or deprecated.
- Only server-side Lua and the API can modify item definitions. Clients cannot create, update, or delete items.
- Bulk operations are fully transactional — all items succeed or all roll back.

---

## Database Changes (Migration 015)

Migration: `packages/db/migrations/015_item_catalog_admin_fields.sql`

New columns on `atc_item_definitions`:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `image_url` | `VARCHAR(512) NULL` | NULL | Optional CDN URL for item image |
| `icon` | `VARCHAR(128) NULL` | NULL | Icon identifier (e.g. Font Awesome class) |
| `tags_json` | `JSON NULL` | NULL | Array of searchable tag strings |
| `sort_order` | `INT NOT NULL` | 0 | Controls display ordering |
| `version` | `INT UNSIGNED NOT NULL` | 1 | Incremented on every update via `update()` or `bulkUpsert()` |

New indexes:
- `idx_items_sort_order` on `(sort_order)` — catalog sort performance
- `idx_items_category_status` on `(category, status)` — filtered catalog queries

> `version` is **not** incremented by the legacy `upsert()` method — only by `update()` and `bulkUpsert()`.

---

## API Endpoints

All endpoints require `Authorization: Bearer <server_token>`.

### POST /api/v1/items/create *(strict CREATE — added in hardening)*

Creates a new item definition. Returns `409 Conflict` if the `id` already exists. This is the correct endpoint when you need guaranteed unique creation.

**Body:** `AtcItemDefinitionCreateRequest`

**Response:** `201 AtcItemDefinition` on success, `409` on duplicate ID, `400` on validation failure or invalid `metadataSchema` format.

> **Why not `POST /api/v1/items`?** The legacy endpoint (`sdk.upsert()`) performs an `INSERT ... ON DUPLICATE KEY UPDATE` — it silently overwrites. Use `sdk.create()` / this endpoint when duplicate detection matters.

### GET /api/v1/items/catalog

Returns all item definitions across all statuses. Supports filtering.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category |
| `status` | `active \| disabled \| deprecated` | Filter by status |
| `tag` | string | Filter by tag (JSON array contains check) |
| `search` | string | LIKE search on id, label, category |
| `limit` | number | Max results (default 100, max 500) |
| `offset` | number | Pagination offset (default 0) |

**Response:** `200 AtcItemDefinition[]`

### POST /api/v1/items/bulk

Transactionally upsert up to 500 item definitions in a single request.

**Body:** `{ items: AtcItemDefinitionCreateRequest[] }` (1–500 items)

**Duplicate ID guard:** If the same `id` appears more than once in `items`, returns `409` immediately without touching the DB.

**Response:** `200 { upserted: number; items: AtcItemDefinition[] }`

### POST /api/v1/items/metadata/validate

Two-stage metadata validation:
1. Validates the `metadataSchema` format against the supported field type spec (Zod).
2. If `sampleMetadata` is provided, validates it against the schema.

Always returns `200` with `{ valid: boolean; errors: string[] }`. Returns `400` only if the request body is malformed.

**Body:** `{ metadataSchema: Record<string, unknown>, sampleMetadata?: Record<string, unknown> }`

### PATCH /api/v1/items/:itemId

Update mutable fields of an existing item definition. Increments `version`. At least one field must be provided.

**Body:** Partial `AtcItemDefinitionUpdateRequest` (all fields optional, but at least one required)

**Responses:** `200` success, `400` validation failure or invalid `metadataSchema` format, `404` not found.

> **metadataSchema format guard (BUG-7-3):** When `metadataSchema` is provided (non-null), it is validated against `inventoryMetadataSchemaSchema` before being stored. Invalid formats (e.g. unsupported property types) return `400` immediately.

### POST /api/v1/items/:itemId/disable

Marks the item as `status: 'disabled'`. Also **increments `version`**. Disabled items are excluded from `GET /api/v1/items` (active-only list) but remain in the catalog and in existing inventory slots.

**Response:** `200 AtcItemDefinition` with `status: 'disabled'`, `404` not found.

### POST /api/v1/items/:itemId/deprecate

Marks the item as `status: 'deprecated'`. Also **increments `version`**. Deprecated items are excluded from active item lists but remain queryable through the catalog.

**Response:** `200 AtcItemDefinition` with `status: 'deprecated'`, `404` not found.

---

## Repository Methods

All new methods are on `ItemDefinitionRepository` in `packages/db`.

### `create(params)` → `AtcItemDefinition`
- Strict `INSERT` — throws `ItemDefinitionDuplicateError` if the ID already exists.
- Use this for new item creation where duplicate detection is needed.
- Does **not** increment `version` (starts at 1 from the DB default).
- Called by `POST /api/v1/items/create` (returns 409 on duplicate). **Not** `POST /api/v1/items` (legacy upsert).

### `update(itemId, patch)` → `AtcItemDefinition`
- Dynamic `SET` builder — only touches provided fields.
- Always increments `version = version + 1`.
- Throws `ItemDefinitionNotFoundError` if `affectedRows === 0`.

### `bulkUpsert(items)` → `{ upserted: number; items: AtcItemDefinition[] }`
- Full transaction — all items succeed or all roll back.
- Uses `ON DUPLICATE KEY UPDATE ... version = version + 1`.
- Returns count of processed items and the fetched definitions after commit.

### `listCatalog(query)` → `AtcItemDefinition[]`
- Filters: `category`, `status`, `tag` (JSON_CONTAINS), `search` (LIKE on id/label/category).
- Ordered by `sort_order ASC, id ASC`.
- Includes items of all statuses (active, disabled, deprecated).

### `getUsageCount(itemId)` → `number`
- Returns the number of inventory slots currently holding this item across all characters.
- Use before disabling an item to check live impact.

### `safeDisable(itemId)` → `AtcItemDefinition`
- Sets `status = 'disabled'`, throws `ItemDefinitionNotFoundError` if not found.

### `safeDeprecate(itemId)` → `AtcItemDefinition`
- Sets `status = 'deprecated'`, throws `ItemDefinitionNotFoundError` if not found.

---

## Lua Item Cache (FiveM Server-Side)

The FiveM server-side caches active item definitions in memory to avoid repeated HTTP calls during gameplay.

**Cache TTL:** 60 seconds (configurable via `ATC_ITEM_CACHE_TTL` before resource start, or `ATC.Config.ItemCacheTTL`).

**API:**
```lua
-- Look up a single item definition by ID (fetches from cache or API)
ATC.Inventory.GetItemDefinition(itemId, function(ok, item)
    if ok then
        -- item.weightGrams, item.stackable, item.maxStack, etc.
    end
end)

-- Get all active item definitions (as an array)
ATC.Inventory.ListItemDefinitions(function(ok, items)
    -- items is a flat array of item definition tables
end)

-- Force-refresh the cache from the API (e.g. after admin bulk upsert)
ATC.Inventory.RefreshItemCache(function(ok, items)
    -- cache is now fresh
end)
```

**Behavior:**
- Cache is loaded lazily on first call.
- Subsequent calls within the TTL window are served from memory.
- Cache only contains items from `GET /api/v1/items` (status = active).
- After a `RefreshItemCache`, the TTL resets.

---

## SDK Usage (TypeScript)

```typescript
import { AtcItemsSDK } from '@atc/sdk'

const items = new AtcItemsSDK(httpClient)

// Admin filtered catalog
const catalog = await items.catalog({ status: 'active', category: 'consumable' })

// Create a new item
const item = await items.create({
  id: 'premium_water',
  label: 'Premium Water',
  category: 'consumable',
  weightGrams: 250,
  tags: ['drink', 'food'],
})

// Update a field
const updated = await items.update('premium_water', { label: 'Sparkling Water' })

// Bulk upsert for seeding/importing
const result = await items.bulkUpsert({ items: [...] })

// Lifecycle transitions
await items.disable('premium_water')
await items.deprecate('old_item')

// Validate a metadata schema before saving
const validation = await items.validateMetadata({
  metadataSchema: { durability: { type: 'number', min: 0, max: 100 } },
  sampleMetadata: { durability: 75 },
})
if (!validation?.valid) {
  console.error(validation?.errors)
}
```

---

## Shared Types

All types are in `packages/shared-types/src/inventory.ts` and exported from `@atc/shared-types`.

| Type | Purpose |
|---|---|
| `AtcItemDefinition` | Full item definition (includes new fields) |
| `AtcItemDefinitionCreateRequest` | Body for create/bulk upsert |
| `AtcItemDefinitionUpdateRequest` | Body for PATCH (all fields optional) |
| `AtcItemDefinitionBulkUpsertRequest` | `{ items: AtcItemDefinitionCreateRequest[] }` |
| `AtcItemDefinitionBulkUpsertResponse` | `{ upserted: number; items: AtcItemDefinition[] }` |
| `AtcItemMetadataValidationRequest` | `{ metadataSchema, sampleMetadata? }` |
| `AtcItemMetadataValidationResponse` | `{ valid: boolean; errors: string[] }` |
| `AtcItemCatalogQuery` | Catalog filter params |

---

## Localization Keys (i18n)

Namespace: `item`

| Key | Purpose |
|---|---|
| `item.catalog` | Catalog title |
| `item.created` | Item created confirmation (with `{{id}}`) |
| `item.updated` | Item updated confirmation (with `{{id}}`) |
| `item.disabled` | Item disabled notice (with `{{id}}`) |
| `item.deprecated` | Item deprecated notice (with `{{id}}`) |
| `item.not_found` | Item definition not found error |
| `item.duplicate_id` | Duplicate ID error |
| `item.invalid_metadata_schema` | Schema format error |
| `item.bulk_upsert_complete` | Bulk complete (with `{{count}}`) |
| `item.validation_failed` | Metadata validation failed |

---

## Operational Notes

### Disabling a live item

Check usage before disabling to understand blast radius:
```typescript
const count = await itemDefinitions.getUsageCount('water_bottle')
// count = number of active inventory slots holding this item
```
Disabling does not remove the item from existing inventory slots. Players keep their items; the item just cannot be granted to new players or found in active item lists.

### Cache invalidation after admin changes

After performing bulk imports or updates via the admin panel, force-refresh the Lua server-side cache to immediately reflect changes in gameplay:
```lua
ATC.Inventory.RefreshItemCache()
```

### Rollback on bulk failure

`bulkUpsert` is transactional. If any item in the batch fails (e.g., a constraint violation), **all items** in that batch are rolled back. Duplicate ID detection at the route level (409) prevents the most common cause of batch failure.

### Version tracking

`version` is useful for optimistic concurrency and detecting stale definitions. It increments on every:
- `update()` — PATCH fields
- `bulkUpsert()` — on `ON DUPLICATE KEY UPDATE`
- `safeDisable()` — status transition to disabled
- `safeDeprecate()` — status transition to deprecated

It does **not** increment when using the legacy `upsert()` method.

---

## Hardening Notes (Phase 7 Audit)

The following bugs were found and fixed during the Phase 7 hardening audit:

### BUG-7-1: sdk.create() pointed to legacy upsert endpoint
`AtcItemsSDK.create()` was calling `POST /api/v1/items` (legacy `INSERT...ON DUPLICATE KEY UPDATE`) — duplicates silently succeeded. Fixed by adding dedicated `POST /api/v1/items/create` route that calls `itemDefinitions.create()` (strict INSERT, 409 on duplicate). SDK updated to call `/api/v1/items/create`.

### BUG-7-2: safeDisable/safeDeprecate did not increment version
Status transitions are meaningful changes. Fixed by adding `version = version + 1` to both UPDATE statements.

### BUG-7-3: metadataSchema format not validated before storage
The `metadataSchema` field in create/update/bulk requests was accepted as any arbitrary object (`z.record(z.unknown())`). An item stored with an invalid schema (e.g. `{ properties: { x: { type: 'invalid_type' } } }`) would later cause `validateMetadataSchema` to silently treat it as "no constraint." Fixed by validating all incoming `metadataSchema` values against `inventoryMetadataSchemaSchema` before any DB write in the create, update, and bulk routes. Returns `400` on invalid format.

### BUG-7-4: FiveM cache TTL config override was not wired
Comment said "overridable via ATC.Config.ItemCacheTTL" but no code read this config. Fixed by checking `ATC.Config.ItemCacheTTL` on startup:
```lua
if ATC and ATC.Config and type(ATC.Config.ItemCacheTTL) == 'number' and ATC.Config.ItemCacheTTL > 0 then
    ATC_ITEM_CACHE_TTL = ATC.Config.ItemCacheTTL
end
```

### metadataSchema format reference
The schema format used by `validateMetadataSchema` (and accepted by create/update/validate endpoints):
```json
{
  "required": ["field1"],
  "strict": true,
  "properties": {
    "field1": { "type": "string", "maxLength": 64 },
    "field2": { "type": "number", "min": 0, "max": 100 },
    "field3": { "type": "boolean" }
  }
}
```
Supported types: `string`, `number`, `boolean` only. Flat format (without `properties` wrapper) is silently ignored by Zod's `z.object()` stripping.
