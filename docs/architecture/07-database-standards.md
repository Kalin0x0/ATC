# Database Standards

## Database Engine

- **Primary:** MariaDB 11.x
- **Charset:** `utf8mb4` everywhere (full Unicode + emoji support)
- **Collation:** `utf8mb4_unicode_ci`
- **Storage Engine:** InnoDB (all tables — ACID, foreign keys, transactions)
- **Connection Pooling:** Via `mysql2` with `pool.max = 20`, `pool.min = 5`

---

## Naming Conventions

### Tables
- `snake_case`, **plural**
- Prefix with domain when not globally unique

```sql
-- Core tables
players
characters
player_sessions

-- Domain tables
economy_accounts
economy_transactions
economy_fraud_flags
inventory_items
inventory_stashes
item_definitions
vehicles
garages
properties
territories
territory_events
```

### Columns
- `snake_case`, **singular**
- Boolean: `is_*` or `has_*` prefix
- Counts: `*_count`
- Amounts/prices: `*_amount`, `*_price` (always DECIMAL for money)
- JSON fields: `*_data`, `*_metadata`, `*_json`

```sql
-- Good column names
id, player_id, character_id
created_at, updated_at, deleted_at
is_active, has_insurance
item_count, max_weight
price_amount, balance_amount
metadata_json, mods_data
```

### Primary Keys
- **Always UUID v7** — sortable by time, globally unique, no integer overflow
- Column name: always `id`
- Type: `CHAR(26)` (ULID-style encoding) or `CHAR(36)` (standard UUID with hyphens)
- Generated at **application layer**, not database

```sql
id CHAR(26) NOT NULL PRIMARY KEY  -- UUID v7 encoded as ULID string
```

### Foreign Keys
- Pattern: `{referenced_table_singular}_id`
- Always create an index on FK columns

```sql
player_id     CHAR(26) NOT NULL  -- references players.id
character_id  CHAR(26) NOT NULL  -- references characters.id
vehicle_id    CHAR(26) NOT NULL  -- references vehicles.id
```

### Timestamps
- Always include `created_at` and `updated_at`
- Use `deleted_at` only when soft-delete is explicitly required
- Type: `DATETIME(3)` (3ms precision)
- Default: `DEFAULT CURRENT_TIMESTAMP(3)`
- Update trigger: `ON UPDATE CURRENT_TIMESTAMP(3)`

```sql
created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
```

### Indexes
- Name pattern: `idx_{table}_{column(s)}`
- Unique: `uq_{table}_{column}`
- Foreign key: `fk_{table}_{referenced_table}`

---

## Schema Design Patterns

### Base Table Template

```sql
CREATE TABLE `inventory_items` (
    `id`           CHAR(26)     NOT NULL,
    `character_id` CHAR(26)     NOT NULL,
    `stash_id`     CHAR(26)     NULL,
    `item_name`    VARCHAR(64)  NOT NULL,
    `quantity`     INT UNSIGNED NOT NULL DEFAULT 1,
    `slot`         TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `metadata_json` JSON        NULL,
    `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                   ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `idx_inventory_items_character` (`character_id`),
    INDEX `idx_inventory_items_stash` (`stash_id`),
    INDEX `idx_inventory_items_item_name` (`item_name`),

    CONSTRAINT `fk_inventory_items_characters`
        FOREIGN KEY (`character_id`) REFERENCES `characters` (`id`)
        ON DELETE CASCADE,

    CONSTRAINT `fk_inventory_items_stashes`
        FOREIGN KEY (`stash_id`) REFERENCES `inventory_stashes` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Money Fields (ALWAYS DECIMAL)

```sql
-- CORRECT: Never float for money
`balance_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0.00

-- WRONG: Float loses precision
`balance` FLOAT  -- ❌ never
`balance` DOUBLE -- ❌ never
```

### JSON Fields

Use JSON type for dynamic/variable metadata only:

```sql
-- For metadata that varies per item type
`metadata_json` JSON NULL

-- For a known set of fields, use explicit columns instead
-- Don't hide structure in JSON when it's always the same shape
```

JSON fields must have a documented schema in `packages/core/schemas/`.

### Enums

Avoid MySQL ENUM type — use VARCHAR with application-level validation:

```sql
-- WRONG: Hard to alter in production
`currency_type` ENUM('cash', 'bank', 'black')

-- CORRECT: Flexible, validated in Zod at application level
`currency_type` VARCHAR(32) NOT NULL
```

---

## Migration Standards

### File Naming
```
packages/db/migrations/
├── 001_initial_schema.sql
├── 002_add_economy_fraud_flags.sql
├── 003_add_vehicle_insurance.sql
└── 004_inventory_add_hotbar_slot.sql
```

Pattern: `{three-digit-sequence}_{description}.sql`

### Migration Content Rules

1. Every migration must be **idempotent** (`IF NOT EXISTS`, `IF EXISTS`)
2. Every migration must be **reversible** — include a `-- ROLLBACK:` comment block
3. No data migrations mixed with schema migrations (separate files)
4. Never `ALTER TABLE` in production without checking table size first
5. Large table migrations use `pt-online-schema-change` (documented separately)

### Example Migration

```sql
-- Migration: 002_add_economy_fraud_flags.sql
-- Created: 2026-05-14
-- Author: ATC Core Team
-- Description: Add fraud detection flags for economy transactions

-- ROLLBACK:
-- DROP TABLE IF EXISTS `economy_fraud_flags`;

CREATE TABLE IF NOT EXISTS `economy_fraud_flags` (
    `id`             CHAR(26)    NOT NULL,
    `transaction_id` CHAR(26)    NOT NULL,
    `flag_type`      VARCHAR(64) NOT NULL,
    `severity`       TINYINT     NOT NULL DEFAULT 1 COMMENT '1=low 2=medium 3=high',
    `reviewed`       TINYINT(1)  NOT NULL DEFAULT 0,
    `reviewed_by`    CHAR(26)    NULL,
    `reviewed_at`    DATETIME(3) NULL,
    `metadata_json`  JSON        NULL,
    `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `idx_fraud_flags_transaction` (`transaction_id`),
    INDEX `idx_fraud_flags_reviewed` (`reviewed`),

    CONSTRAINT `fk_fraud_flags_transactions`
        FOREIGN KEY (`transaction_id`) REFERENCES `economy_transactions` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Migration Runner

```bash
# Run all pending migrations
pnpm db:migrate

# Run specific migration
pnpm db:migrate --file 003_add_vehicle_insurance.sql

# Check migration status
pnpm db:migrate:status

# Rollback last migration
pnpm db:migrate:rollback
```

---

## Repository Pattern

Never write raw SQL in business logic. Use the repository layer:

```typescript
// packages/db/repositories/inventory.repo.ts

export class InventoryRepository {
    async getByCharacterId(characterId: string): Promise<InventoryItem[]> {
        return this.db.query<InventoryItem>(
            'SELECT * FROM inventory_items WHERE character_id = ? ORDER BY slot ASC',
            [characterId]
        )
    }

    async addItem(data: CreateInventoryItemDto): Promise<InventoryItem> {
        const id = generateId()
        await this.db.execute(
            'INSERT INTO inventory_items (id, character_id, item_name, quantity, slot, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
            [id, data.characterId, data.itemName, data.quantity, data.slot, JSON.stringify(data.metadata)]
        )
        return this.getById(id)
    }
}
```

### Repository Rules
1. Repositories live in `packages/db/repositories/`
2. One repository per domain table (or tightly related group)
3. Repositories receive a `DatabaseClient` instance (injected)
4. No business logic in repositories — pure data access
5. Validate inputs at service layer with Zod before calling repository

---

## Connection Configuration

```typescript
// packages/db/src/client.ts
export const dbConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
    },
    timezone: 'Z',         // Always UTC
    charset: 'utf8mb4'
}
```

---

## Performance Guidelines

1. **Always index FK columns** — never do an unindexed FK join
2. **Avoid SELECT \*** — always select specific columns in production
3. **Use EXPLAIN** on all new queries before merging
4. **Pagination required** on all list queries — never `LIMIT 9999`
5. **Batch inserts** when inserting >10 rows in a loop
6. **Read from Redis cache** before hitting DB for hot data (player inventory, balances)
7. **Write-through cache** — update Redis after successful DB write
8. **Separate read/write** — long reports use DB read replica (Phase 2+)
