-- ============================================================================
--  Atlantic Core (ATC) - Full Database Schema
--  An open project by Naiemi Group.
--
--  Import this file into a fresh database named `atc` (MariaDB 11 / MySQL 8).
--  Built from 366 ordered schema migrations. See database/README.md
--  for step-by-step instructions (English / فارسی / Türkçe / Español / Deutsch).
-- ============================================================================

SET NAMES utf8mb4;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 001_create_accounts.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_accounts (
  id                  CHAR(26)        NOT NULL,
  primary_identifier  VARCHAR(128)    NOT NULL,
  preferred_language  VARCHAR(8)      NOT NULL DEFAULT 'en',
  status              ENUM('active', 'banned', 'suspended') NOT NULL DEFAULT 'active',
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_primary_identifier (primary_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_account_identifiers (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  account_id          CHAR(26)        NOT NULL,
  identifier_type     VARCHAR(32)     NOT NULL,
  identifier          VARCHAR(128)    NOT NULL,
  created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_identifiers_type_value (identifier_type, identifier),
  UNIQUE KEY uq_identifiers_account_type (account_id, identifier_type),
  CONSTRAINT fk_identifiers_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 002_create_player_sessions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_player_sessions (
  id                  CHAR(26)        NOT NULL,
  account_id          CHAR(26)        NOT NULL,
  source              INT UNSIGNED    NOT NULL,
  name                VARCHAR(256)    NOT NULL,
  primary_identifier  VARCHAR(128)    NOT NULL,
  language            VARCHAR(8)      NOT NULL DEFAULT 'en',
  state               ENUM('connecting', 'active', 'ended') NOT NULL DEFAULT 'connecting',
  connected_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  disconnected_at     DATETIME(3)     NULL,
  PRIMARY KEY (id),
  KEY idx_sessions_source (source),
  KEY idx_sessions_account (account_id),
  KEY idx_sessions_state (state),
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 003_create_bans.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_bans (
  id          CHAR(26)        NOT NULL,
  account_id  CHAR(26)        NOT NULL,
  reason      TEXT            NULL,
  expires_at  DATETIME(3)     NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  banned_by   CHAR(26)        NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_bans_account (account_id),
  KEY idx_bans_active (is_active, expires_at),
  CONSTRAINT fk_bans_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 004_add_identifier_index.sql
-- ---------------------------------------------------------------------------
-- Add standalone index on atc_account_identifiers.identifier for cross-identifier lookups.
-- The existing composite index (identifier_type, identifier) doesn't efficiently serve
-- queries that search by identifier value alone across all types.
ALTER TABLE atc_account_identifiers
  ADD INDEX idx_identifiers_value (identifier);

-- ---------------------------------------------------------------------------
-- 005_create_characters.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_characters (
  id              CHAR(26)                              NOT NULL,
  account_id      CHAR(26)                              NOT NULL,
  slot            TINYINT UNSIGNED                      NOT NULL,
  first_name      VARCHAR(64)                           NOT NULL,
  last_name       VARCHAR(64)                           NOT NULL,
  date_of_birth   DATE                                  NULL,
  gender          ENUM('male', 'female', 'other')       NOT NULL DEFAULT 'other',
  nationality     VARCHAR(64)                           NULL,
  metadata        JSON                                  NULL,
  status          ENUM('active', 'deleted', 'suspended') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_characters_account_slot (account_id, slot),
  KEY idx_characters_account (account_id),
  KEY idx_characters_status (status),
  KEY idx_characters_name (first_name, last_name),
  CONSTRAINT fk_characters_account FOREIGN KEY (account_id)
    REFERENCES atc_accounts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 006_alter_sessions_add_character.sql
-- ---------------------------------------------------------------------------
ALTER TABLE atc_player_sessions
  ADD COLUMN IF NOT EXISTS character_id CHAR(26) NULL AFTER account_id,
  ADD KEY IF NOT EXISTS idx_sessions_character (character_id),
  ADD CONSTRAINT IF NOT EXISTS fk_sessions_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 007_alter_characters_slot_nullable.sql
-- ---------------------------------------------------------------------------
-- Allow slot to be NULL for soft-deleted characters so the slot number is freed for reuse.
-- MariaDB treats NULL values as distinct in unique indexes, so multiple deleted rows
-- with NULL slot for the same account are allowed. Only active/suspended rows keep their slot.
ALTER TABLE atc_characters
  MODIFY COLUMN slot TINYINT UNSIGNED NULL;

-- ---------------------------------------------------------------------------
-- 008_create_wallets.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_wallets (
  id              CHAR(26)                              NOT NULL,
  character_id    CHAR(26)                              NOT NULL,
  currency        VARCHAR(8)                            NOT NULL DEFAULT 'ATC',
  cash_balance    BIGINT UNSIGNED                       NOT NULL DEFAULT 0,
  bank_balance    BIGINT UNSIGNED                       NOT NULL DEFAULT 0,
  status          ENUM('active','frozen','closed')      NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)                           NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallets_character_currency (character_id, currency),
  KEY idx_wallets_character (character_id),
  KEY idx_wallets_status (status),
  CONSTRAINT fk_wallets_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 009_create_wallet_transactions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_wallet_transactions (
  id                CHAR(26)                                      NOT NULL,
  wallet_id         CHAR(26)                                      NOT NULL,
  character_id      CHAR(26)                                      NOT NULL,
  type              ENUM('credit','debit','transfer')             NOT NULL,
  account           ENUM('cash','bank')                           NOT NULL,
  amount            BIGINT UNSIGNED                               NOT NULL,
  balance_after     BIGINT UNSIGNED                               NOT NULL,
  currency          VARCHAR(8)                                    NOT NULL DEFAULT 'ATC',
  reason            VARCHAR(128)                                  NOT NULL,
  source            ENUM('system','admin','api','gameplay')       NOT NULL DEFAULT 'system',
  idempotency_key   VARCHAR(128)                                  NOT NULL,
  metadata          JSON                                          NULL,
  created_at        DATETIME(3)                                   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_idempotency (idempotency_key),
  KEY idx_transactions_wallet (wallet_id),
  KEY idx_transactions_character (character_id),
  KEY idx_transactions_currency (currency),
  KEY idx_transactions_created (created_at),
  CONSTRAINT fk_transactions_wallet FOREIGN KEY (wallet_id)
    REFERENCES atc_wallets (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 010_alter_wallet_transactions_add_payload_hash.sql
-- ---------------------------------------------------------------------------
-- Migration 010: Add payload_hash to wallet transactions
-- Stores a SHA-256 hex digest of the canonicalized mutation payload
-- (amount + account/fromAccount + currency). Used to detect idempotency key
-- reuse with a different payload, which indicates a caller bug.
-- NULL for records written before this migration (skips verification on replay).

ALTER TABLE atc_wallet_transactions
  ADD COLUMN payload_hash CHAR(64) NULL
    AFTER idempotency_key;

-- ---------------------------------------------------------------------------
-- 011_create_item_definitions.sql
-- ---------------------------------------------------------------------------
-- Migration 011: Item definition registry
-- Global catalogue of all item types. Mutations reference this table.
-- status = 'active' is required to add the item to any character inventory.

CREATE TABLE IF NOT EXISTS atc_item_definitions (
  id                    VARCHAR(64)                                      NOT NULL,
  label                 VARCHAR(128)                                     NOT NULL,
  description           VARCHAR(512)                                     NULL,
  category              VARCHAR(64)                                      NOT NULL,
  stackable             TINYINT(1) UNSIGNED                              NOT NULL DEFAULT 1,
  max_stack             INT UNSIGNED                                     NOT NULL DEFAULT 100,
  weight_grams          INT UNSIGNED                                     NOT NULL DEFAULT 0,
  usable                TINYINT(1) UNSIGNED                              NOT NULL DEFAULT 0,
  tradable              TINYINT(1) UNSIGNED                              NOT NULL DEFAULT 1,
  metadata_schema_json  JSON                                             NULL,
  status                ENUM('active','disabled','deprecated')           NOT NULL DEFAULT 'active',
  created_at            DATETIME(3)                                      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)                                      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT chk_item_max_stack    CHECK (max_stack >= 1),
  CONSTRAINT chk_item_weight       CHECK (weight_grams >= 0),
  KEY idx_item_definitions_category (category),
  KEY idx_item_definitions_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 012_create_character_inventory.sql
-- ---------------------------------------------------------------------------
-- Migration 012: Character inventory slots
-- One row per occupied slot. Empty slots are not stored.
-- UNIQUE(character_id, slot) prevents double-occupancy at the DB level.

CREATE TABLE IF NOT EXISTS atc_character_inventory (
  id             CHAR(26)       NOT NULL,
  character_id   CHAR(26)       NOT NULL,
  item_id        VARCHAR(64)    NOT NULL,
  slot           INT UNSIGNED   NOT NULL,
  quantity       INT UNSIGNED   NOT NULL,
  metadata_json  JSON           NULL,
  created_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_character_slot (character_id, slot),
  KEY idx_inventory_character (character_id),
  KEY idx_inventory_item     (item_id),
  CONSTRAINT chk_inventory_slot     CHECK (slot     BETWEEN 1 AND 120),
  CONSTRAINT chk_inventory_quantity CHECK (quantity >= 1),
  CONSTRAINT fk_inventory_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_item FOREIGN KEY (item_id)
    REFERENCES atc_item_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 013_create_inventory_transactions.sql
-- ---------------------------------------------------------------------------
-- Migration 013: Inventory transaction ledger (append-only audit log)
-- Every inventory mutation produces exactly one ledger row.
-- UNIQUE(idempotency_key) is the DB-level safety net for double-write prevention.

CREATE TABLE IF NOT EXISTS atc_inventory_transactions (
  id              CHAR(26)                                        NOT NULL,
  character_id    CHAR(26)                                        NOT NULL,
  type            ENUM('add','remove','move','set')               NOT NULL,
  item_id         VARCHAR(64)                                     NULL,
  slot_from       INT UNSIGNED                                    NULL,
  slot_to         INT UNSIGNED                                    NULL,
  quantity        INT UNSIGNED                                    NULL,
  reason          VARCHAR(128)                                    NOT NULL,
  source          ENUM('system','admin','api','gameplay')         NOT NULL DEFAULT 'system',
  idempotency_key VARCHAR(128)                                    NOT NULL,
  payload_hash    CHAR(64)                                        NULL,
  metadata_json   JSON                                            NULL,
  created_at      DATETIME(3)                                     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_inv_tx_idempotency (idempotency_key),
  KEY idx_inv_tx_character (character_id),
  KEY idx_inv_tx_type      (type),
  KEY idx_inv_tx_item      (item_id),
  KEY idx_inv_tx_created   (created_at),
  CONSTRAINT fk_inv_tx_character FOREIGN KEY (character_id)
    REFERENCES atc_characters (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 014_inventory_performance_and_capacity.sql
-- ---------------------------------------------------------------------------
-- Migration 014: Inventory performance indexes and per-character capacity settings
-- Adds composite index for stack-merge lookup and introduces per-character capacity settings table.

ALTER TABLE atc_character_inventory
  ADD INDEX IF NOT EXISTS idx_inventory_character_item (character_id, item_id);

CREATE TABLE IF NOT EXISTS atc_character_inventory_settings (
  character_id     CHAR(26)     NOT NULL,
  max_slots        INT UNSIGNED NOT NULL DEFAULT 60,
  max_weight_grams INT UNSIGNED NOT NULL DEFAULT 30000,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (character_id),
  CONSTRAINT fk_inv_settings_character
    FOREIGN KEY (character_id) REFERENCES atc_characters (id) ON DELETE CASCADE,
  CONSTRAINT chk_inv_settings_max_slots
    CHECK (max_slots BETWEEN 1 AND 120),
  CONSTRAINT chk_inv_settings_max_weight
    CHECK (max_weight_grams >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 015_item_catalog_admin_fields.sql
-- ---------------------------------------------------------------------------
-- Migration 015: Item catalog admin fields
-- Adds image, icon, tags, sort ordering, and version tracking to item definitions.
-- Does NOT remove or rename any existing columns; existing inventory FKs remain intact.

ALTER TABLE atc_item_definitions
  ADD COLUMN IF NOT EXISTS image_url  VARCHAR(512)   NULL         AFTER metadata_schema_json,
  ADD COLUMN IF NOT EXISTS icon       VARCHAR(128)   NULL         AFTER image_url,
  ADD COLUMN IF NOT EXISTS tags_json  JSON           NULL         AFTER icon,
  ADD COLUMN IF NOT EXISTS sort_order INT            NOT NULL DEFAULT 0   AFTER tags_json,
  ADD COLUMN IF NOT EXISTS version    INT UNSIGNED   NOT NULL DEFAULT 1   AFTER sort_order;

CREATE INDEX IF NOT EXISTS idx_items_sort_order        ON atc_item_definitions (sort_order);
CREATE INDEX IF NOT EXISTS idx_items_category_status   ON atc_item_definitions (category, status);

-- ---------------------------------------------------------------------------
-- 016_item_runtime_fields.sql
-- ---------------------------------------------------------------------------
-- Migration 016 â€” Item Runtime Fields
-- Phase 8: Usable Item Runtime
-- Adds runtime slot fields (durability, equipped, last_used_at) to character inventory
-- and action config storage to item definitions.
-- All statements use IF NOT EXISTS guards for safe re-run idempotency.

-- â”€â”€ atc_character_inventory: runtime slot fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE atc_character_inventory
  ADD COLUMN IF NOT EXISTS durability   INT UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipped     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP NULL DEFAULT NULL;

-- Durability check constraint (separate statement for safety across MariaDB versions)
ALTER TABLE atc_character_inventory
  ADD CONSTRAINT IF NOT EXISTS chk_inv_durability CHECK (durability >= 0);

CREATE INDEX IF NOT EXISTS idx_inv_equipped ON atc_character_inventory (character_id, equipped);

-- â”€â”€ atc_item_definitions: action config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Stores the runtime action config (type, cooldownMs, consumeQuantity, etc.)
-- NULL = item is not usable via the runtime.

ALTER TABLE atc_item_definitions
  ADD COLUMN IF NOT EXISTS action_config_json JSON NULL DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- 017_create_character_vitals.sql
-- ---------------------------------------------------------------------------
-- ATC Migration 017 â€” Character Vitals
-- Creates the atc_character_vitals table for server-authoritative player state.
-- All mutations happen server-side only. Clients are never trusted for vitals values.
--
-- Column types: TINYINT UNSIGNED (1 byte, 0â€“255) is correct for 0â€“100 vitals.
-- Timestamps: DATETIME(3) for millisecond precision, consistent with all ATC tables.

CREATE TABLE IF NOT EXISTS atc_character_vitals (
    character_id  CHAR(26)          NOT NULL,
    health        TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    hunger        TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    thirst        TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    stamina       TINYINT UNSIGNED  NOT NULL DEFAULT 100,
    stress        TINYINT UNSIGNED  NOT NULL DEFAULT 0,
    armor         TINYINT UNSIGNED  NOT NULL DEFAULT 0,
    created_at    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (character_id),

    CONSTRAINT fk_vitals_character
        FOREIGN KEY (character_id) REFERENCES atc_characters (id)
        ON DELETE CASCADE,

    CONSTRAINT chk_vitals_health  CHECK (health  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_hunger  CHECK (hunger  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_thirst  CHECK (thirst  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_stamina CHECK (stamina BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_stress  CHECK (stress  BETWEEN 0 AND 100),
    CONSTRAINT chk_vitals_armor   CHECK (armor   BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 018_create_principals.sql
-- ---------------------------------------------------------------------------
-- ATC Migration 018 â€” IAM Principal Store
-- Stores persistent principal records (accounts, services, plugins, system actors).
-- Roles and capabilities are in separate tables to allow individual grant/revoke tracking.
-- direct_permissions and direct_denies are JSON arrays for per-principal overrides.

CREATE TABLE IF NOT EXISTS atc_principals (
    id                  CHAR(26)        NOT NULL,
    principal_type      VARCHAR(20)     NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'active',
    display_name        VARCHAR(256)    NOT NULL,
    account_id          CHAR(26)        NULL,
    trust_level         VARCHAR(20)     NULL,
    direct_permissions  JSON            NOT NULL DEFAULT (JSON_ARRAY()),
    direct_denies       JSON            NOT NULL DEFAULT (JSON_ARRAY()),
    metadata            JSON            NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    KEY idx_principals_type   (principal_type),
    KEY idx_principals_status (status),
    KEY idx_principals_account (account_id),

    CONSTRAINT chk_principal_type   CHECK (principal_type IN ('account', 'service', 'plugin', 'system')),
    CONSTRAINT chk_principal_status CHECK (status IN ('active', 'disabled', 'suspended')),
    CONSTRAINT chk_trust_level      CHECK (trust_level IS NULL OR trust_level IN ('internal', 'trusted', 'untrusted', 'restricted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 019_create_role_assignments.sql
-- ---------------------------------------------------------------------------
-- ATC Migration 019 â€” Role Assignments
-- Persistent role grants for IAM principals. UNIQUE on (principal_id, role_id) so
-- a role cannot be double-assigned; re-assigning is idempotent via INSERT IGNORE.
-- expires_at NULL means the assignment never expires.

CREATE TABLE IF NOT EXISTS atc_role_assignments (
    id              CHAR(26)        NOT NULL,
    principal_id    CHAR(26)        NOT NULL,
    role_id         VARCHAR(64)     NOT NULL,
    assigned_by     VARCHAR(128)    NOT NULL,
    assigned_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at      DATETIME(3)     NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_principal_role (principal_id, role_id),
    KEY idx_role_assignments_principal (principal_id),
    KEY idx_role_assignments_expires   (expires_at),

    CONSTRAINT fk_role_assign_principal
        FOREIGN KEY (principal_id) REFERENCES atc_principals (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 020_create_capability_assignments.sql
-- ---------------------------------------------------------------------------
-- ATC Migration 020 â€” Capability Assignments
-- Individual capability grants for IAM principals. UNIQUE on (principal_id, capability).
-- Trust-level enforcement still applies at authorization time; this table only records grants.

CREATE TABLE IF NOT EXISTS atc_capability_assignments (
    id              CHAR(26)        NOT NULL,
    principal_id    CHAR(26)        NOT NULL,
    capability      VARCHAR(128)    NOT NULL,
    granted_by      VARCHAR(128)    NOT NULL,
    granted_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at      DATETIME(3)     NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_principal_capability (principal_id, capability),
    KEY idx_capability_principal (principal_id),
    KEY idx_capability_expires   (expires_at),

    CONSTRAINT fk_capability_principal
        FOREIGN KEY (principal_id) REFERENCES atc_principals (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 021_create_security_events.sql
-- ---------------------------------------------------------------------------
-- ATC Migration 021 â€” Durable Security Events
-- Append-only audit log written to the database for durability.
-- Complements the in-memory AtcAuditService ring buffer (Phase 19).
-- event_metadata avoids the reserved word 'metadata' in some SQL dialects.

CREATE TABLE IF NOT EXISTS atc_security_events (
    id                  CHAR(26)        NOT NULL,
    actor_id            VARCHAR(128)    NOT NULL,
    actor_type          VARCHAR(20)     NOT NULL,
    action              VARCHAR(256)    NOT NULL,
    target              VARCHAR(256)    NULL,
    result              VARCHAR(10)     NOT NULL,
    source_instance_id  VARCHAR(128)    NULL,
    event_metadata      JSON            NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    KEY idx_sec_events_actor   (actor_id),
    KEY idx_sec_events_action  (action(64)),
    KEY idx_sec_events_result  (result),
    KEY idx_sec_events_created (created_at),

    CONSTRAINT chk_sec_event_result CHECK (result IN ('granted', 'denied', 'error'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 022_create_financial_accounts.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: financial accounts (ledger accounts)
CREATE TABLE IF NOT EXISTS atc_financial_accounts (
    id              CHAR(26)        NOT NULL,
    owner_type      VARCHAR(20)     NOT NULL,
    owner_id        VARCHAR(128)    NOT NULL,
    account_type    VARCHAR(20)     NOT NULL,
    currency        VARCHAR(16)     NOT NULL DEFAULT 'USD',
    balance         DECIMAL(20,4)   NOT NULL DEFAULT 0.0000,
    balance_version BIGINT          NOT NULL DEFAULT 0,
    status          VARCHAR(20)     NOT NULL DEFAULT 'active',
    metadata        JSON            NULL,
    created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_fa_owner      (owner_type, owner_id),
    KEY idx_fa_status     (status),
    KEY idx_fa_currency   (currency),
    CONSTRAINT chk_fa_owner_type  CHECK (owner_type   IN ('character', 'organization', 'system')),
    CONSTRAINT chk_fa_type        CHECK (account_type IN ('cash', 'bank', 'treasury', 'escrow', 'system')),
    CONSTRAINT chk_fa_status      CHECK (status       IN ('active', 'frozen', 'closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 023_create_financial_journals.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: double-entry journal headers (one per atomic commit)
CREATE TABLE IF NOT EXISTS atc_financial_journals (
    id               CHAR(26)        NOT NULL,
    idempotency_key  VARCHAR(256)    NOT NULL,
    description      VARCHAR(512)    NOT NULL,
    source           VARCHAR(20)     NOT NULL DEFAULT 'system',
    status           VARCHAR(20)     NOT NULL DEFAULT 'committed',
    reference_id     VARCHAR(128)    NULL,
    reference_type   VARCHAR(64)     NULL,
    reversal_of_id   CHAR(26)        NULL,
    committed_at     DATETIME(3)     NULL,
    reversed_at      DATETIME(3)     NULL,
    created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_journal_idempotency (idempotency_key),
    KEY idx_journal_status    (status),
    KEY idx_journal_reference (reference_type, reference_id),
    KEY idx_journal_reversal  (reversal_of_id),
    CONSTRAINT chk_journal_status CHECK (status IN ('pending', 'committed', 'reversed')),
    CONSTRAINT chk_journal_source CHECK (source IN ('system', 'admin', 'api', 'gameplay'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 024_create_financial_entries.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: double-entry journal lines (debit/credit)
-- Each journal must have sum(debits) == sum(credits); enforced in LedgerService.
CREATE TABLE IF NOT EXISTS atc_financial_entries (
    id          CHAR(26)        NOT NULL,
    journal_id  CHAR(26)        NOT NULL,
    account_id  CHAR(26)        NOT NULL,
    entry_type  VARCHAR(10)     NOT NULL,
    amount      DECIMAL(20,4)   NOT NULL,
    currency    VARCHAR(16)     NOT NULL DEFAULT 'USD',
    created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_fe_journal (journal_id),
    KEY idx_fe_account (account_id),
    CONSTRAINT fk_fe_journal FOREIGN KEY (journal_id) REFERENCES atc_financial_journals (id) ON DELETE CASCADE,
    CONSTRAINT fk_fe_account FOREIGN KEY (account_id) REFERENCES atc_financial_accounts (id),
    CONSTRAINT chk_fe_entry_type CHECK (entry_type IN ('debit', 'credit')),
    CONSTRAINT chk_fe_amount     CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 025_create_organizations.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: organizations (businesses, factions, government, charities)
CREATE TABLE IF NOT EXISTS atc_organizations (
    id                   CHAR(26)        NOT NULL,
    name                 VARCHAR(64)     NOT NULL,
    display_name         VARCHAR(256)    NOT NULL,
    type                 VARCHAR(20)     NOT NULL DEFAULT 'business',
    status               VARCHAR(20)     NOT NULL DEFAULT 'active',
    treasury_account_id  CHAR(26)        NULL,
    owner_id             VARCHAR(128)    NOT NULL,
    metadata             JSON            NULL,
    created_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at           DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_org_name  (name),
    KEY idx_org_owner       (owner_id),
    KEY idx_org_status      (status),
    CONSTRAINT chk_org_type   CHECK (type   IN ('business', 'faction', 'government', 'charity')),
    CONSTRAINT chk_org_status CHECK (status IN ('active', 'suspended', 'dissolved'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 026_create_organization_members.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: organization membership with role and optional expiry
CREATE TABLE IF NOT EXISTS atc_organization_members (
    id               CHAR(26)        NOT NULL,
    organization_id  CHAR(26)        NOT NULL,
    character_id     VARCHAR(128)    NOT NULL,
    role             VARCHAR(20)     NOT NULL DEFAULT 'employee',
    joined_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at       DATETIME(3)     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_org_member    (organization_id, character_id),
    KEY idx_member_character    (character_id),
    KEY idx_member_org_role     (organization_id, role),
    CONSTRAINT fk_member_org  FOREIGN KEY (organization_id) REFERENCES atc_organizations (id) ON DELETE CASCADE,
    CONSTRAINT chk_member_role CHECK (role IN ('owner', 'director', 'accountant', 'employee', 'auditor'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 027_create_invoices.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: invoices issued between characters or organizations
CREATE TABLE IF NOT EXISTS atc_invoices (
    id                  CHAR(26)        NOT NULL,
    issuer_id           VARCHAR(128)    NOT NULL,
    issuer_type         VARCHAR(20)     NOT NULL,
    recipient_id        VARCHAR(128)    NOT NULL,
    recipient_type      VARCHAR(20)     NOT NULL,
    amount              DECIMAL(20,4)   NOT NULL,
    currency            VARCHAR(16)     NOT NULL DEFAULT 'USD',
    description         VARCHAR(512)    NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'draft',
    due_at              DATETIME(3)     NULL,
    paid_at             DATETIME(3)     NULL,
    cancelled_at        DATETIME(3)     NULL,
    payment_journal_id  CHAR(26)        NULL,
    metadata            JSON            NULL,
    created_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at          DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_invoice_issuer    (issuer_type, issuer_id),
    KEY idx_invoice_recipient (recipient_type, recipient_id),
    KEY idx_invoice_status    (status),
    CONSTRAINT chk_inv_issuer_type    CHECK (issuer_type    IN ('character', 'organization')),
    CONSTRAINT chk_inv_recipient_type CHECK (recipient_type IN ('character', 'organization')),
    CONSTRAINT chk_inv_status         CHECK (status         IN ('draft', 'issued', 'paid', 'cancelled', 'overdue')),
    CONSTRAINT chk_inv_amount         CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 028_create_invoice_payments.sql
-- ---------------------------------------------------------------------------
-- Phase 21 â€” Economy Core: payment records linked to invoices and journals
CREATE TABLE IF NOT EXISTS atc_invoice_payments (
    id          CHAR(26)        NOT NULL,
    invoice_id  CHAR(26)        NOT NULL,
    amount      DECIMAL(20,4)   NOT NULL,
    currency    VARCHAR(16)     NOT NULL DEFAULT 'USD',
    journal_id  CHAR(26)        NOT NULL,
    paid_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_ip_invoice (invoice_id),
    KEY idx_ip_journal (journal_id),
    CONSTRAINT fk_ip_invoice FOREIGN KEY (invoice_id) REFERENCES atc_invoices (id),
    CONSTRAINT fk_ip_journal FOREIGN KEY (journal_id) REFERENCES atc_financial_journals (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 029_create_shops.sql
-- ---------------------------------------------------------------------------
-- Phase 22 â€” Commerce: shops catalog
CREATE TABLE IF NOT EXISTS atc_shops (
  id                 CHAR(26)        NOT NULL,
  name               VARCHAR(256)    NOT NULL,
  type               VARCHAR(20)     NOT NULL,
  status             VARCHAR(20)     NOT NULL DEFAULT 'active',
  owner_org_id       CHAR(26)        NULL,
  seller_account_id  CHAR(26)        NULL  COMMENT 'Financial account that receives revenue from player purchases',
  buyer_account_id   CHAR(26)        NULL  COMMENT 'Financial account that pays players when shop buys items',
  currency           VARCHAR(16)     NOT NULL DEFAULT 'USD',
  metadata_json      JSON            NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_shops_type      (type),
  KEY idx_shops_status    (status),
  KEY idx_shops_owner_org (owner_org_id),
  CONSTRAINT chk_shops_type   CHECK (type   IN ('npc','player','organization','vending','admin')),
  CONSTRAINT chk_shops_status CHECK (status IN ('active','disabled','maintenance'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 030_create_shop_items.sql
-- ---------------------------------------------------------------------------
-- Phase 22 â€” Commerce: shop item listings
-- UNIQUE(shop_id, item_id) prevents duplicate listings per shop.
-- stock = -1 means unlimited.
-- sell_price NULL means the shop does not buy this item from players.
CREATE TABLE IF NOT EXISTS atc_shop_items (
  id            CHAR(26)        NOT NULL,
  shop_id       CHAR(26)        NOT NULL,
  item_id       VARCHAR(64)     NOT NULL,
  stock         INT             NOT NULL DEFAULT -1  COMMENT '-1 = unlimited',
  price         DECIMAL(20,4)   NOT NULL,
  sell_price    DECIMAL(20,4)   NULL     COMMENT 'Price shop pays player; NULL = not buyable by shop',
  currency      VARCHAR(16)     NOT NULL DEFAULT 'USD',
  min_level     SMALLINT UNSIGNED NULL,
  metadata_json JSON            NULL,
  created_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_shop_item (shop_id, item_id),
  KEY idx_shop_items_shop  (shop_id),
  KEY idx_shop_items_item  (item_id),
  CONSTRAINT fk_shop_items_shop FOREIGN KEY (shop_id) REFERENCES atc_shops(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_items_item FOREIGN KEY (item_id) REFERENCES atc_item_definitions(id),
  CONSTRAINT chk_shop_items_stock      CHECK (stock >= -1),
  CONSTRAINT chk_shop_items_price      CHECK (price > 0),
  CONSTRAINT chk_shop_items_sell_price CHECK (sell_price IS NULL OR sell_price > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 031_create_commerce_orders.sql
-- ---------------------------------------------------------------------------
-- Phase 22 â€” Commerce: orders (append-only, idempotency-keyed)
-- Orders are the durable record of every commerce transaction attempt.
-- Completed orders always have a journal_id. Failed orders may not.
CREATE TABLE IF NOT EXISTS atc_commerce_orders (
  id               CHAR(26)        NOT NULL,
  idempotency_key  VARCHAR(256)    NOT NULL,
  order_type       VARCHAR(10)     NOT NULL  COMMENT 'purchase | sell',
  status           VARCHAR(10)     NOT NULL  DEFAULT 'pending',
  character_id     VARCHAR(128)    NOT NULL,
  shop_id          CHAR(26)        NOT NULL,
  payer_account_id CHAR(26)        NOT NULL  COMMENT 'Account debited',
  payee_account_id CHAR(26)        NOT NULL  COMMENT 'Account credited',
  item_id          VARCHAR(64)     NOT NULL,
  quantity         INT UNSIGNED    NOT NULL  DEFAULT 1,
  unit_price       DECIMAL(20,4)   NOT NULL,
  subtotal_amount  DECIMAL(20,4)   NOT NULL,
  tax_amount       DECIMAL(20,4)   NOT NULL  DEFAULT '0.0000',
  fee_amount       DECIMAL(20,4)   NOT NULL  DEFAULT '0.0000',
  total_amount     DECIMAL(20,4)   NOT NULL,
  currency         VARCHAR(16)     NOT NULL,
  journal_id       CHAR(26)        NULL,
  failure_reason   VARCHAR(512)    NULL,
  created_at       DATETIME(3)     NOT NULL  DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)     NOT NULL  DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_idempotency (idempotency_key),
  KEY idx_orders_character  (character_id),
  KEY idx_orders_shop       (shop_id),
  KEY idx_orders_status     (status),
  KEY idx_orders_type       (order_type),
  KEY idx_orders_created    (created_at),
  CONSTRAINT chk_orders_type     CHECK (order_type IN ('purchase','sell')),
  CONSTRAINT chk_orders_status   CHECK (status     IN ('pending','completed','failed','refunded')),
  CONSTRAINT chk_orders_qty      CHECK (quantity >= 1),
  CONSTRAINT chk_orders_unit     CHECK (unit_price > 0),
  CONSTRAINT chk_orders_subtotal CHECK (subtotal_amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 032_create_commerce_receipts.sql
-- ---------------------------------------------------------------------------
-- Phase 22 â€” Commerce: receipts (immutable, one per completed order)
-- Receipts are the human-readable proof of a completed transaction.
-- UNIQUE(order_id) enforces one receipt per order at the DB level.
CREATE TABLE IF NOT EXISTS atc_commerce_receipts (
  id              CHAR(26)        NOT NULL,
  order_id        CHAR(26)        NOT NULL,
  order_type      VARCHAR(10)     NOT NULL,
  character_id    VARCHAR(128)    NOT NULL,
  shop_id         CHAR(26)        NOT NULL,
  item_id         VARCHAR(64)     NOT NULL,
  item_name       VARCHAR(256)    NULL,
  quantity        INT UNSIGNED    NOT NULL,
  unit_price      DECIMAL(20,4)   NOT NULL,
  subtotal_amount DECIMAL(20,4)   NOT NULL,
  tax_amount      DECIMAL(20,4)   NOT NULL,
  fee_amount      DECIMAL(20,4)   NOT NULL,
  total_amount    DECIMAL(20,4)   NOT NULL,
  currency        VARCHAR(16)     NOT NULL,
  journal_id      CHAR(26)        NOT NULL,
  issued_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_receipt_order (order_id),
  KEY idx_receipts_character (character_id),
  KEY idx_receipts_shop      (shop_id),
  KEY idx_receipts_issued    (issued_at),
  CONSTRAINT fk_receipts_order FOREIGN KEY (order_id) REFERENCES atc_commerce_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 033_create_tax_rules.sql
-- ---------------------------------------------------------------------------
-- Phase 22 â€” Commerce: tax and fee rules
-- Shared table for both tax and fee rules, distinguished by 'category'.
-- rate: percentage 0-100 for 'percentage' type; fixed monetary amount for 'flat' type.
-- currency NULL means the rule applies to all currencies.
-- applies_to_shop_type NULL means the rule applies to all shop types.
CREATE TABLE IF NOT EXISTS atc_tax_rules (
  id                    CHAR(26)        NOT NULL,
  name                  VARCHAR(256)    NOT NULL,
  category              VARCHAR(5)      NOT NULL  COMMENT 'tax | fee',
  type                  VARCHAR(12)     NOT NULL  COMMENT 'percentage | flat',
  rate                  DECIMAL(10,4)   NOT NULL,
  currency              VARCHAR(16)     NULL      COMMENT 'NULL = all currencies',
  applies_to_shop_type  VARCHAR(20)     NULL      COMMENT 'NULL = all shop types',
  target_account_id     CHAR(26)        NOT NULL  COMMENT 'Financial account that collects the tax/fee',
  is_active             TINYINT(1)      NOT NULL  DEFAULT 1,
  created_at            DATETIME(3)     NOT NULL  DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_tax_rules_active   (is_active),
  KEY idx_tax_rules_category (category),
  KEY idx_tax_rules_currency (currency),
  CONSTRAINT chk_tax_rules_category  CHECK (category IN ('tax','fee')),
  CONSTRAINT chk_tax_rules_type      CHECK (type     IN ('percentage','flat')),
  CONSTRAINT chk_tax_rules_rate      CHECK (rate >= 0),
  CONSTRAINT chk_tax_rules_shop_type CHECK (applies_to_shop_type IS NULL OR applies_to_shop_type IN ('npc','player','organization','vending','admin'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 034_create_jobs.sql
-- ---------------------------------------------------------------------------
-- Phase 23 â€” Jobs: job registry
CREATE TABLE IF NOT EXISTS atc_jobs (
  id                CHAR(26)      NOT NULL,
  slug              VARCHAR(64)   NOT NULL,
  name              VARCHAR(256)  NOT NULL,
  type              VARCHAR(20)   NOT NULL,
  status            VARCHAR(20)   NOT NULL DEFAULT 'active',
  organization_id   CHAR(26)      NULL     COMMENT 'Owning organization for org-linked jobs',
  salary_account_id CHAR(26)      NULL     COMMENT 'Financial account debited on payroll',
  metadata_json     JSON          NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_jobs_slug   (slug),
  KEY idx_jobs_type         (type),
  KEY idx_jobs_status       (status),
  KEY idx_jobs_org          (organization_id),
  CONSTRAINT chk_jobs_type   CHECK (type   IN ('civilian','organization','government','freelance','system')),
  CONSTRAINT chk_jobs_status CHECK (status IN ('active','disabled','archived'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 035_create_job_grades.sql
-- ---------------------------------------------------------------------------
-- Phase 23 â€” Jobs: pay grades within a job
CREATE TABLE IF NOT EXISTS atc_job_grades (
  id               CHAR(26)      NOT NULL,
  job_id           CHAR(26)      NOT NULL,
  slug             VARCHAR(64)   NOT NULL,
  name             VARCHAR(256)  NOT NULL,
  level            INT           NOT NULL DEFAULT 0 COMMENT 'Higher = more senior',
  salary_amount    DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  salary_currency  VARCHAR(16)   NOT NULL DEFAULT 'USD',
  permissions_json JSON          NULL     COMMENT 'Array of permission key strings',
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_job_grades_slug  (job_id, slug),
  KEY idx_job_grades_job         (job_id),
  KEY idx_job_grades_level       (job_id, level),
  CONSTRAINT chk_job_grades_salary  CHECK (salary_amount >= 0),
  CONSTRAINT chk_job_grades_level   CHECK (level >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 036_create_professions.sql
-- ---------------------------------------------------------------------------
-- Phase 23 â€” Jobs: character profession progression records
CREATE TABLE IF NOT EXISTS atc_professions (
  id                CHAR(26)  NOT NULL,
  character_id      CHAR(26)  NOT NULL,
  job_id            CHAR(26)  NOT NULL,
  grade_id          CHAR(26)  NOT NULL,
  level             INT       NOT NULL DEFAULT 1,
  experience_points INT       NOT NULL DEFAULT 0,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_professions_char_job (character_id, job_id),
  KEY idx_professions_char  (character_id),
  KEY idx_professions_job   (job_id),
  CONSTRAINT chk_professions_level CHECK (level >= 1),
  CONSTRAINT chk_professions_xp    CHECK (experience_points >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 037_create_employment_contracts.sql
-- ---------------------------------------------------------------------------
-- Phase 23 â€” Jobs: employment contracts linking characters to jobs/organizations
CREATE TABLE IF NOT EXISTS atc_employment_contracts (
  id                      CHAR(26)      NOT NULL,
  character_id            CHAR(26)      NOT NULL,
  organization_id         CHAR(26)      NULL     COMMENT 'NULL for civilian/freelance jobs',
  job_id                  CHAR(26)      NOT NULL,
  grade_id                CHAR(26)      NOT NULL,
  status                  VARCHAR(20)   NOT NULL DEFAULT 'active',
  salary_amount           DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  salary_currency         VARCHAR(16)   NOT NULL DEFAULT 'USD',
  started_at              DATETIME(3)   NOT NULL,
  ends_at                 DATETIME(3)   NULL     COMMENT 'NULL = no expiry',
  terminated_at           DATETIME(3)   NULL,
  termination_reason      TEXT          NULL,
  created_by_principal_id CHAR(26)      NOT NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_contracts_character  (character_id),
  KEY idx_contracts_org        (organization_id),
  KEY idx_contracts_job        (job_id),
  KEY idx_contracts_status     (status),
  KEY idx_contracts_char_org   (character_id, organization_id, status),
  CONSTRAINT chk_contracts_status CHECK (status IN ('active','suspended','terminated','expired')),
  CONSTRAINT chk_contracts_salary CHECK (salary_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 038_create_work_sessions.sql
-- ---------------------------------------------------------------------------
-- Phase 23 â€” Jobs: work sessions (clock-in / clock-out)
CREATE TABLE IF NOT EXISTS atc_work_sessions (
  id               CHAR(26)    NOT NULL,
  contract_id      CHAR(26)    NOT NULL,
  character_id     CHAR(26)    NOT NULL,
  job_id           CHAR(26)    NOT NULL,
  clocked_in_at    DATETIME(3) NOT NULL,
  clocked_out_at   DATETIME(3) NULL,
  duration_seconds INT         NULL COMMENT 'Computed on clock-out; NULL while session is active',
  location_json    JSON        NULL COMMENT 'Optional location metadata provided by the server',
  verified_by      CHAR(26)    NULL COMMENT 'Principal or system that verified this session',
  status           VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sessions_contract   (contract_id),
  KEY idx_sessions_character  (character_id),
  KEY idx_sessions_status     (status),
  KEY idx_sessions_clocked_in (clocked_in_at),
  CONSTRAINT chk_sessions_status   CHECK (status IN ('active','completed','abandoned')),
  CONSTRAINT chk_sessions_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 039_create_payroll_runs.sql
-- ---------------------------------------------------------------------------
-- Phase 23 â€” Jobs: payroll runs and per-employee entries
CREATE TABLE IF NOT EXISTS atc_payroll_runs (
  id                      CHAR(26)      NOT NULL,
  organization_id         CHAR(26)      NOT NULL,
  period_start            DATETIME(3)   NOT NULL,
  period_end              DATETIME(3)   NOT NULL,
  status                  VARCHAR(20)   NOT NULL DEFAULT 'preview',
  total_amount            DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  currency                VARCHAR(16)   NOT NULL DEFAULT 'USD',
  employee_count          INT           NOT NULL DEFAULT 0,
  ledger_journal_id       CHAR(26)      NULL     COMMENT 'Set after successful payroll commit',
  idempotency_key         VARCHAR(256)  NOT NULL,
  failure_reason          TEXT          NULL,
  created_by_principal_id CHAR(26)      NOT NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_idempotency (idempotency_key),
  KEY idx_payroll_org    (organization_id),
  KEY idx_payroll_status (status),
  KEY idx_payroll_period (organization_id, period_start, period_end),
  CONSTRAINT chk_payroll_status       CHECK (status IN ('preview','pending','completed','failed')),
  CONSTRAINT chk_payroll_period_order CHECK (period_end > period_start),
  CONSTRAINT chk_payroll_total        CHECK (total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_payroll_run_entries (
  id             CHAR(26)      NOT NULL,
  payroll_run_id CHAR(26)      NOT NULL,
  contract_id    CHAR(26)      NOT NULL,
  character_id   CHAR(26)      NOT NULL,
  grade_id       CHAR(26)      NOT NULL,
  hours_worked   DECIMAL(8,2)  NOT NULL DEFAULT '0.00',
  salary_amount  DECIMAL(15,4) NOT NULL DEFAULT '0.0000',
  currency       VARCHAR(16)   NOT NULL DEFAULT 'USD',
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_payroll_entries_run      (payroll_run_id),
  KEY idx_payroll_entries_contract (contract_id),
  KEY idx_payroll_entries_char     (character_id),
  CONSTRAINT fk_payroll_entries_run FOREIGN KEY (payroll_run_id)
    REFERENCES atc_payroll_runs (id) ON DELETE CASCADE,
  CONSTRAINT chk_payroll_entries_salary CHECK (salary_amount >= 0),
  CONSTRAINT chk_payroll_entries_hours  CHECK (hours_worked >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 040_create_agencies.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: agencies (police, EMS, courts, corrections, government)
CREATE TABLE IF NOT EXISTS atc_agencies (
  id              CHAR(26)     NOT NULL,
  slug            VARCHAR(64)  NOT NULL,
  name            VARCHAR(256) NOT NULL,
  type            VARCHAR(32)  NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  organization_id CHAR(26)     NULL,
  description     TEXT         NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_agency_slug (slug),
  KEY idx_agency_type   (type),
  KEY idx_agency_status (status),
  KEY idx_agency_org    (organization_id),
  CONSTRAINT chk_agency_type   CHECK (type   IN ('police','ems','government','court','corrections')),
  CONSTRAINT chk_agency_status CHECK (status IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 041_create_warrants.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: arrest warrants
CREATE TABLE IF NOT EXISTS atc_warrants (
  id                     CHAR(26)    NOT NULL,
  character_id           CHAR(26)    NOT NULL,
  issued_by_principal_id CHAR(26)    NOT NULL,
  agency_id              CHAR(26)    NOT NULL,
  severity               VARCHAR(20) NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'active',
  reason                 TEXT        NOT NULL,
  expires_at             DATETIME(3) NULL,
  executed_at            DATETIME(3) NULL,
  revoked_at             DATETIME(3) NULL,
  revoke_reason          TEXT        NULL,
  created_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_warrant_char     (character_id),
  KEY idx_warrant_agency   (agency_id),
  KEY idx_warrant_status   (status),
  KEY idx_warrant_severity (severity),
  CONSTRAINT chk_warrant_severity CHECK (severity IN ('infraction','misdemeanor','felony')),
  CONSTRAINT chk_warrant_status   CHECK (status   IN ('active','executed','expired','revoked')),
  CONSTRAINT fk_warrant_agency    FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 042_create_citations.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: citations / fines (ledger-backed payments)
CREATE TABLE IF NOT EXISTS atc_citations (
  id                     CHAR(26)      NOT NULL,
  character_id           CHAR(26)      NOT NULL,
  issued_by_principal_id CHAR(26)      NOT NULL,
  agency_id              CHAR(26)      NOT NULL,
  reason                 TEXT          NOT NULL,
  amount                 DECIMAL(15,4) NOT NULL,
  currency               VARCHAR(16)   NOT NULL DEFAULT 'USD',
  status                 VARCHAR(20)   NOT NULL DEFAULT 'unpaid',
  ledger_journal_id      CHAR(26)      NULL     COMMENT 'Set after successful ledger-backed payment',
  idempotency_key        VARCHAR(256)  NOT NULL,
  paid_at                DATETIME(3)   NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_citation_idempotency (idempotency_key),
  KEY idx_citation_char   (character_id),
  KEY idx_citation_agency (agency_id),
  KEY idx_citation_status (status),
  CONSTRAINT chk_citation_status CHECK (status IN ('unpaid','paid','voided','disputed')),
  CONSTRAINT chk_citation_amount CHECK (amount >= 0),
  CONSTRAINT fk_citation_agency  FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 043_create_arrest_records.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: arrest records (append-only, no updated_at)
CREATE TABLE IF NOT EXISTS atc_arrest_records (
  id                       CHAR(26)    NOT NULL,
  character_id             CHAR(26)    NOT NULL,
  arrested_by_principal_id CHAR(26)    NOT NULL,
  agency_id                CHAR(26)    NOT NULL,
  warrant_id               CHAR(26)    NULL     COMMENT 'NULL when override capability used instead of active warrant',
  reason                   TEXT        NOT NULL,
  severity                 VARCHAR(20) NOT NULL,
  notes                    TEXT        NULL,
  created_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_arrest_char    (character_id),
  KEY idx_arrest_agency  (agency_id),
  KEY idx_arrest_warrant (warrant_id),
  KEY idx_arrest_created (created_at),
  CONSTRAINT chk_arrest_severity CHECK (severity IN ('infraction','misdemeanor','felony')),
  CONSTRAINT fk_arrest_agency    FOREIGN KEY (agency_id)  REFERENCES atc_agencies (id),
  CONSTRAINT fk_arrest_warrant   FOREIGN KEY (warrant_id) REFERENCES atc_warrants (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 044_create_jail_records.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: jail/custody state (server-authoritative, append-safe)
CREATE TABLE IF NOT EXISTS atc_jail_records (
  id                       CHAR(26)    NOT NULL,
  character_id             CHAR(26)    NOT NULL,
  arrest_record_id         CHAR(26)    NOT NULL,
  start_at                 DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  release_at               DATETIME(3) NULL,
  released_by_principal_id CHAR(26)    NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_jail_char   (character_id),
  KEY idx_jail_arrest (arrest_record_id),
  KEY idx_jail_status (status),
  CONSTRAINT chk_jail_status CHECK (status IN ('active','released')),
  CONSTRAINT fk_jail_arrest  FOREIGN KEY (arrest_record_id) REFERENCES atc_arrest_records (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 045_create_evidence_records.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: evidence records (immutable hash, append-only chain of custody)
CREATE TABLE IF NOT EXISTS atc_evidence_records (
  id                        CHAR(26)     NOT NULL,
  case_id                   CHAR(26)     NULL,
  collected_by_principal_id CHAR(26)     NOT NULL,
  label                     VARCHAR(512) NOT NULL,
  metadata_json             JSON         NULL,
  content_hash              CHAR(64)     NOT NULL COMMENT 'SHA-256 hex of canonical evidence fingerprint at collection time',
  chain_of_custody_json     JSON         NOT NULL DEFAULT ('[]'),
  created_at                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_evidence_case      (case_id),
  KEY idx_evidence_collector (collected_by_principal_id),
  KEY idx_evidence_hash      (content_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 046_create_legal_cases.sql
-- ---------------------------------------------------------------------------
-- Phase 24 â€” Government: legal cases (links warrants, evidence, arrests, citations)
CREATE TABLE IF NOT EXISTS atc_legal_cases (
  id                      CHAR(26)     NOT NULL,
  title                   VARCHAR(512) NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'open',
  agency_id               CHAR(26)     NOT NULL,
  created_by_principal_id CHAR(26)     NOT NULL,
  notes                   TEXT         NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_case_agency  (agency_id),
  KEY idx_case_status  (status),
  KEY idx_case_creator (created_by_principal_id),
  CONSTRAINT chk_case_status CHECK (status IN ('open','closed','archived')),
  CONSTRAINT fk_case_agency  FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 047_create_dispatch_calls.sql
-- ---------------------------------------------------------------------------
-- Phase 25 â€” Dispatch: inbound calls (civilian/officer/api) awaiting dispatch
CREATE TABLE IF NOT EXISTS atc_dispatch_calls (
  id                 CHAR(26)     NOT NULL,
  source             VARCHAR(20)  NOT NULL DEFAULT 'civilian',
  caller_identifier  VARCHAR(255) NULL,
  location           VARCHAR(512) NOT NULL,
  priority           VARCHAR(20)  NOT NULL DEFAULT 'medium',
  description        TEXT         NOT NULL,
  incident_id        CHAR(26)     NULL,
  idempotency_key    VARCHAR(255) NOT NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  accepted_at        DATETIME(3)  NULL,
  closed_at          DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dispatch_idempotency (idempotency_key),
  KEY idx_dispatch_source   (source),
  KEY idx_dispatch_priority (priority),
  KEY idx_dispatch_incident (incident_id),
  KEY idx_dispatch_created  (created_at),
  CONSTRAINT chk_dispatch_source   CHECK (source   IN ('civilian','officer','automated','api')),
  CONSTRAINT chk_dispatch_priority CHECK (priority IN ('low','medium','high','critical'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 048_create_incidents.sql
-- ---------------------------------------------------------------------------
-- Phase 25 â€” Dispatch: incident records linking evidence, arrests, citations
CREATE TABLE IF NOT EXISTS atc_incidents (
  id                      CHAR(26)     NOT NULL,
  call_id                 CHAR(26)     NULL,
  agency_id               CHAR(26)     NOT NULL,
  status                  VARCHAR(20)  NOT NULL DEFAULT 'open',
  priority                VARCHAR(20)  NOT NULL DEFAULT 'medium',
  title                   VARCHAR(512) NOT NULL,
  location                VARCHAR(512) NULL,
  notes                   JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  evidence_ids            JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  arrest_ids              JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  citation_ids            JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  created_by_principal_id CHAR(26)     NOT NULL,
  resolved_at             DATETIME(3)  NULL,
  archived_at             DATETIME(3)  NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_incident_agency   (agency_id),
  KEY idx_incident_status   (status),
  KEY idx_incident_priority (priority),
  KEY idx_incident_call     (call_id),
  KEY idx_incident_created  (created_at),
  CONSTRAINT chk_incident_status   CHECK (status   IN ('open','active','resolved','archived')),
  CONSTRAINT chk_incident_priority CHECK (priority IN ('low','medium','high','critical')),
  CONSTRAINT fk_incident_agency    FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 049_create_responder_assignments.sql
-- ---------------------------------------------------------------------------
-- Phase 25 â€” Dispatch: responder assignments to incidents
CREATE TABLE IF NOT EXISTS atc_responder_assignments (
  id                CHAR(26)    NOT NULL,
  incident_id       CHAR(26)    NOT NULL,
  principal_id      CHAR(26)    NOT NULL,
  character_id      CHAR(26)    NULL,
  agency_id         CHAR(26)    NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'assigned',
  assigned_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status_updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cleared_at        DATETIME(3) NULL,
  PRIMARY KEY (id),
  KEY idx_responder_incident  (incident_id),
  KEY idx_responder_principal (principal_id),
  KEY idx_responder_agency    (agency_id),
  KEY idx_responder_status    (status),
  CONSTRAINT chk_responder_status CHECK (status IN ('assigned','enroute','on_scene','unavailable','cleared')),
  CONSTRAINT fk_responder_incident FOREIGN KEY (incident_id) REFERENCES atc_incidents (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 050_create_bolo_records.sql
-- ---------------------------------------------------------------------------
-- Phase 25 â€” Dispatch: Be-On-Lookout records
CREATE TABLE IF NOT EXISTS atc_bolo_records (
  id                      CHAR(26)     NOT NULL,
  agency_id               CHAR(26)     NOT NULL,
  created_by_principal_id CHAR(26)     NOT NULL,
  severity                VARCHAR(20)  NOT NULL DEFAULT 'misdemeanor',
  description             TEXT         NOT NULL,
  linked_warrant_id       CHAR(26)     NULL,
  linked_character_id     CHAR(26)     NULL,
  linked_vehicle_id       CHAR(26)     NULL,
  notes                   JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  status                  VARCHAR(20)  NOT NULL DEFAULT 'active',
  expires_at              DATETIME(3)  NULL,
  expired_at              DATETIME(3)  NULL,
  archived_at             DATETIME(3)  NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_bolo_agency    (agency_id),
  KEY idx_bolo_status    (status),
  KEY idx_bolo_character (linked_character_id),
  KEY idx_bolo_warrant   (linked_warrant_id),
  KEY idx_bolo_expires   (expires_at),
  KEY idx_bolo_created   (created_at),
  CONSTRAINT chk_bolo_status   CHECK (status   IN ('active','expired','archived')),
  CONSTRAINT chk_bolo_severity CHECK (severity IN ('infraction','misdemeanor','felony')),
  CONSTRAINT fk_bolo_agency    FOREIGN KEY (agency_id) REFERENCES atc_agencies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 051_create_injuries.sql
-- ---------------------------------------------------------------------------
-- Phase 26 â€” Medical: injury records (append-only, indexed by character)
CREATE TABLE IF NOT EXISTS atc_injuries (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  agency_id                CHAR(26)     NULL,
  incident_id              CHAR(26)     NULL,
  recorded_by_principal_id CHAR(26)     NOT NULL,
  region                   VARCHAR(20)  NOT NULL,
  severity                 VARCHAR(20)  NOT NULL DEFAULT 'minor',
  description              TEXT         NOT NULL,
  metadata                 JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_injury_character (character_id),
  KEY idx_injury_incident  (incident_id),
  KEY idx_injury_severity  (severity),
  KEY idx_injury_created   (created_at),
  CONSTRAINT chk_injury_region   CHECK (region   IN ('head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','spine')),
  CONSTRAINT chk_injury_severity CHECK (severity IN ('minor','moderate','critical','fatal'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 052_create_trauma_states.sql
-- ---------------------------------------------------------------------------
-- Phase 26 â€” Medical: one active trauma state per character (upsert pattern)
CREATE TABLE IF NOT EXISTS atc_trauma_states (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  state                    VARCHAR(20)  NOT NULL DEFAULT 'stable',
  previous_state           VARCHAR(20)  NULL,
  updated_by_principal_id  CHAR(26)     NOT NULL,
  notes                    TEXT         NULL,
  state_changed_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_trauma_character (character_id),
  KEY idx_trauma_state   (state),
  KEY idx_trauma_updated (updated_at),
  CONSTRAINT chk_trauma_state CHECK (state IN ('stable','bleeding','unconscious','cardiac_arrest','fractured','pain_shock','stabilized','deceased'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 053_create_treatment_records.sql
-- ---------------------------------------------------------------------------
-- Phase 26 â€” Medical: treatment records (append-only, never updated)
CREATE TABLE IF NOT EXISTS atc_treatment_records (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  applied_by_principal_id  CHAR(26)     NOT NULL,
  incident_id              CHAR(26)     NULL,
  type                     VARCHAR(20)  NOT NULL,
  item_id                  VARCHAR(128) NULL,
  notes                    TEXT         NULL,
  previous_trauma          VARCHAR(20)  NULL,
  resulting_trauma         VARCHAR(20)  NULL,
  metadata                 JSON         NOT NULL DEFAULT (JSON_OBJECT()),
  applied_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_treatment_character (character_id),
  KEY idx_treatment_incident  (incident_id),
  KEY idx_treatment_type      (type),
  KEY idx_treatment_applied   (applied_at),
  CONSTRAINT chk_treatment_type CHECK (type IN ('bandage','defibrillator','medication','splint','tourniquet','cpr','revive','stabilize','transfer','other'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 054_create_medical_reports.sql
-- ---------------------------------------------------------------------------
-- Phase 26 â€” Medical: medical reports (immutable after closure)
CREATE TABLE IF NOT EXISTS atc_medical_reports (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  created_by_principal_id  CHAR(26)     NOT NULL,
  incident_id              CHAR(26)     NULL,
  arrest_id                CHAR(26)     NULL,
  diagnosis                TEXT         NOT NULL,
  notes                    TEXT         NOT NULL DEFAULT '',
  injury_ids               JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  treatment_ids            JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  vitals_snapshot          JSON         NULL,
  closed_at                DATETIME(3)  NULL,
  closed_by_principal_id   CHAR(26)     NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_report_character (character_id),
  KEY idx_report_incident  (incident_id),
  KEY idx_report_closed    (closed_at),
  KEY idx_report_created   (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 055_create_hospital_states.sql
-- ---------------------------------------------------------------------------
-- Phase 26 â€” Medical: hospital admission state (one active per character)
CREATE TABLE IF NOT EXISTS atc_hospital_states (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  admitted_by_principal_id CHAR(26)     NOT NULL,
  status                   VARCHAR(20)  NOT NULL DEFAULT 'admitted',
  facility_id              VARCHAR(128) NULL,
  incident_id              CHAR(26)     NULL,
  notes                    TEXT         NULL,
  admitted_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  status_changed_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  discharged_at            DATETIME(3)  NULL,
  updated_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hospital_character (character_id),
  KEY idx_hospital_status    (status),
  KEY idx_hospital_admitted  (admitted_at),
  CONSTRAINT chk_hospital_status CHECK (status IN ('admitted','icu','surgery','discharged','deceased'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 056_create_entity_registry.sql
-- ---------------------------------------------------------------------------
-- Phase 27 â€” Entity Registry: canonical entity directory
-- Append-safe, idempotent, indexed for high-cardinality lookups.
CREATE TABLE IF NOT EXISTS atc_entity_registry (
  id              CHAR(26)     NOT NULL,
  entity_type     VARCHAR(32)  NOT NULL,
  external_id     VARCHAR(128) NOT NULL,
  display_name    VARCHAR(255) NULL,
  source_system   VARCHAR(64)  NOT NULL,
  metadata_json   TEXT         NULL,
  visibility      VARCHAR(20)  NOT NULL DEFAULT 'public',
  created_by      VARCHAR(128) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_entity_type_external (entity_type, external_id),
  KEY idx_entity_type        (entity_type),
  KEY idx_entity_external    (external_id),
  KEY idx_entity_display     (display_name),
  KEY idx_entity_source      (source_system),
  KEY idx_entity_visibility  (visibility),
  KEY idx_entity_created     (created_at),
  CONSTRAINT chk_entity_type CHECK (
    entity_type IN (
      'character','vehicle','incident','warrant','arrest',
      'citation','bolo','evidence','organization','account'
    )
  ),
  CONSTRAINT chk_entity_visibility CHECK (visibility IN ('public','internal','restricted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 057_create_entity_relationships.sql
-- ---------------------------------------------------------------------------
-- Phase 27 â€” Entity Relationship Graph: typed directional edges
-- Append-only edge log. Edges are immutable; relationship end-of-life is
-- modelled via `ended_at`. Traversal is optimised by composite indexes on
-- both endpoints + edge type.
CREATE TABLE IF NOT EXISTS atc_entity_relationships (
  id              CHAR(26)     NOT NULL,
  from_entity_id  CHAR(26)     NOT NULL,
  to_entity_id    CHAR(26)     NOT NULL,
  relationship    VARCHAR(64)  NOT NULL,
  weight          DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  source_system   VARCHAR(64)  NOT NULL,
  attribution     VARCHAR(128) NULL,
  metadata_json   TEXT         NULL,
  observed_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at        DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_rel_from         (from_entity_id, relationship, observed_at),
  KEY idx_rel_to           (to_entity_id, relationship, observed_at),
  KEY idx_rel_pair         (from_entity_id, to_entity_id, relationship),
  KEY idx_rel_type         (relationship),
  KEY idx_rel_observed     (observed_at),
  KEY idx_rel_active       (ended_at),
  CONSTRAINT chk_rel_endpoints CHECK (from_entity_id <> to_entity_id),
  CONSTRAINT chk_rel_weight    CHECK (weight >= 0 AND weight <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 058_create_entity_aliases.sql
-- ---------------------------------------------------------------------------
-- Phase 27 â€” Entity Aliases: alternate identifiers / names / external IDs
-- Append-safe alias log. Aliases are case-folded for index lookups via a
-- generated lowercase column (MariaDB 10.6+ / MySQL 8.0+).
CREATE TABLE IF NOT EXISTS atc_entity_aliases (
  id              CHAR(26)     NOT NULL,
  entity_id       CHAR(26)     NOT NULL,
  alias_kind      VARCHAR(32)  NOT NULL,
  alias_value     VARCHAR(255) NOT NULL,
  alias_value_lc  VARCHAR(255) GENERATED ALWAYS AS (LOWER(alias_value)) STORED,
  source_system   VARCHAR(64)  NOT NULL,
  created_by      VARCHAR(128) NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_alias_entity_kind_value (entity_id, alias_kind, alias_value),
  KEY idx_alias_value_lc    (alias_value_lc),
  KEY idx_alias_entity      (entity_id),
  KEY idx_alias_kind        (alias_kind),
  KEY idx_alias_created     (created_at),
  CONSTRAINT chk_alias_kind CHECK (
    alias_kind IN ('name','nickname','phone','plate','email','external_id','badge','vin','tag')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 059_create_ems_emergencies.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_ems_emergencies (
  id                       CHAR(26)     NOT NULL,
  character_id             VARCHAR(128) NOT NULL,
  incident_id              VARCHAR(128) NULL,
  status                   ENUM(
    'reported','triaged','responders_assigned','en_route',
    'on_scene','stabilized','transported','admitted','closed'
  ) NOT NULL DEFAULT 'reported',
  triage_category          ENUM('red','yellow','green','black') NULL,
  assigned_responder_ids   JSON         NOT NULL DEFAULT ('[]'),
  notes                    TEXT         NULL,
  created_by_principal_id  VARCHAR(128) NOT NULL,
  closed_at                DATETIME(3)  NULL,
  created_at               DATETIME(3)  NOT NULL,
  updated_at               DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_ems_emergency_character (character_id),
  INDEX idx_ems_emergency_status    (status),
  INDEX idx_ems_emergency_incident  (incident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 060_create_ems_emergency_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_ems_emergency_audit (
  id            CHAR(26)     NOT NULL,
  emergency_id  CHAR(26)     NOT NULL,
  action        VARCHAR(64)  NOT NULL,
  from_status   VARCHAR(32)  NULL,
  to_status     VARCHAR(32)  NULL,
  principal_id  VARCHAR(128) NOT NULL,
  notes         TEXT         NULL,
  metadata      JSON         NOT NULL DEFAULT ('{}'),
  created_at    DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_ems_audit_emergency  (emergency_id),
  INDEX idx_ems_audit_principal  (principal_id),
  INDEX idx_ems_audit_created    (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 061_create_ems_ambulances.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_ems_ambulances (
  id               CHAR(26)     NOT NULL,
  unit_id          VARCHAR(128) NOT NULL,
  status           ENUM('available','dispatched','en_route','transporting','hospital') NOT NULL DEFAULT 'available',
  emergency_id     CHAR(26)     NULL,
  facility_id      VARCHAR(128) NULL,
  last_updated_by  VARCHAR(128) NOT NULL,
  created_at       DATETIME(3)  NOT NULL,
  updated_at       DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ambulance_unit  (unit_id),
  INDEX idx_ambulance_status    (status),
  INDEX idx_ambulance_emergency (emergency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 062_create_ems_hospital_capacity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_ems_hospital_capacity (
  id              CHAR(26)     NOT NULL,
  facility_id     VARCHAR(128) NOT NULL,
  total_beds      INT          NOT NULL DEFAULT 0,
  available_beds  INT          NOT NULL DEFAULT 0,
  icu_total       INT          NOT NULL DEFAULT 0,
  icu_available   INT          NOT NULL DEFAULT 0,
  er_total        INT          NOT NULL DEFAULT 0,
  er_available    INT          NOT NULL DEFAULT 0,
  is_diversion    TINYINT(1)   NOT NULL DEFAULT 0,
  is_overflow     TINYINT(1)   NOT NULL DEFAULT 0,
  updated_at      DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_hospital_facility (facility_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 063_create_ems_revive_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_ems_revive_audit (
  id                        CHAR(26)     NOT NULL,
  character_id              VARCHAR(128) NOT NULL,
  emergency_id              CHAR(26)     NULL,
  revived_by_principal_id   VARCHAR(128) NOT NULL,
  previous_state            VARCHAR(32)  NOT NULL,
  resulting_state           VARCHAR(32)  NOT NULL,
  notes                     TEXT         NULL,
  revived_at                DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_revive_audit_character  (character_id),
  INDEX idx_revive_audit_principal  (revived_by_principal_id),
  INDEX idx_revive_audit_revived    (revived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 064_create_vehicles.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicles (
  id              CHAR(26)       NOT NULL,
  owner_id        CHAR(26)       NULL,
  organization_id CHAR(26)       NULL,
  plate           VARCHAR(8)     NOT NULL,
  vin             VARCHAR(17)    NOT NULL,
  model           VARCHAR(64)    NOT NULL,
  category        ENUM('civilian','police','ems','fire','government','other')
                                 NOT NULL DEFAULT 'civilian',
  status          ENUM('stored','spawned','active','impounded','destroyed')
                                 NOT NULL DEFAULT 'stored',
  fuel            TINYINT UNSIGNED NOT NULL DEFAULT 100,
  body_health     SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
  engine_health   SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
  mileage         INT UNSIGNED   NOT NULL DEFAULT 0,
  garage_id       VARCHAR(64)    NULL,
  last_x          DOUBLE         NULL,
  last_y          DOUBLE         NULL,
  last_z          DOUBLE         NULL,
  last_heading    FLOAT          NULL,
  is_locked       TINYINT(1)     NOT NULL DEFAULT 1,
  is_engine_on    TINYINT(1)     NOT NULL DEFAULT 0,
  color_primary   VARCHAR(16)    NULL,
  color_secondary VARCHAR(16)    NULL,
  mod_hash        VARCHAR(64)    NULL,
  created_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_plate (plate),
  UNIQUE KEY uq_vehicle_vin   (vin),
  INDEX idx_vehicle_owner        (owner_id),
  INDEX idx_vehicle_organization (organization_id),
  INDEX idx_vehicle_status       (status),
  INDEX idx_vehicle_garage       (garage_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 065_create_vehicle_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_runtime (
  id                       CHAR(26)       NOT NULL,
  vehicle_id               CHAR(26)       NOT NULL,
  spawned_by_principal_id  VARCHAR(128)   NOT NULL,
  net_id                   INT            NULL,
  server_handle            INT            NULL,
  x                        DOUBLE         NOT NULL DEFAULT 0,
  y                        DOUBLE         NOT NULL DEFAULT 0,
  z                        DOUBLE         NOT NULL DEFAULT 0,
  heading                  FLOAT          NOT NULL DEFAULT 0,
  fuel                     TINYINT UNSIGNED NOT NULL DEFAULT 100,
  body_health              SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
  engine_health            SMALLINT UNSIGNED NOT NULL DEFAULT 1000,
  is_locked                TINYINT(1)     NOT NULL DEFAULT 1,
  is_engine_on             TINYINT(1)     NOT NULL DEFAULT 0,
  last_heartbeat_at        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at               DATETIME(3)    NULL,
  spawned_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                          ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vrt_vehicle (vehicle_id),
  CONSTRAINT fk_vrt_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 066_create_vehicle_garages.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_garages (
  id                           CHAR(26)     NOT NULL,
  vehicle_id                   CHAR(26)     NOT NULL,
  garage_id                    VARCHAR(64)  NOT NULL,
  stored_by_principal_id       VARCHAR(128) NOT NULL,
  stored_at                    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  retrieved_at                 DATETIME(3)  NULL,
  retrieved_by_principal_id    VARCHAR(128) NULL,
  PRIMARY KEY (id),
  INDEX idx_vg_vehicle      (vehicle_id),
  INDEX idx_vg_garage       (garage_id),
  INDEX idx_vg_active       (vehicle_id, retrieved_at),
  CONSTRAINT fk_vg_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 067_create_vehicle_impounds.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_impounds (
  id                           CHAR(26)     NOT NULL,
  vehicle_id                   CHAR(26)     NOT NULL,
  reason                       ENUM('traffic_stop','abandoned','evidence',
                                    'unpaid_fees','emergency_tow','other')
                                            NOT NULL,
  impounded_by_principal_id    VARCHAR(128) NOT NULL,
  agency_id                    CHAR(26)     NULL,
  location_id                  VARCHAR(64)  NULL,
  evidence_hold                TINYINT(1)   NOT NULL DEFAULT 0,
  fee                          INT UNSIGNED NOT NULL DEFAULT 0,
  notes                        TEXT         NULL,
  impounded_at                 DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at                  DATETIME(3)  NULL,
  released_by_principal_id     VARCHAR(128) NULL,
  release_notes                TEXT         NULL,
  PRIMARY KEY (id),
  INDEX idx_vi_vehicle (vehicle_id),
  INDEX idx_vi_active  (vehicle_id, released_at),
  CONSTRAINT fk_vi_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 068_create_vehicle_fleet_assignments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_fleet_assignments (
  id                           CHAR(26)     NOT NULL,
  vehicle_id                   CHAR(26)     NOT NULL,
  organization_id              CHAR(26)     NULL,
  principal_id                 VARCHAR(128) NULL,
  assigned_by_principal_id     VARCHAR(128) NOT NULL,
  role                         VARCHAR(64)  NOT NULL DEFAULT 'general',
  expires_at                   DATETIME(3)  NULL,
  unassigned_at                DATETIME(3)  NULL,
  unassigned_by_principal_id   VARCHAR(128) NULL,
  assigned_at                  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_vfa_vehicle      (vehicle_id),
  INDEX idx_vfa_organization (organization_id),
  INDEX idx_vfa_principal    (principal_id),
  INDEX idx_vfa_active       (vehicle_id, unassigned_at),
  CONSTRAINT fk_vfa_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 069_create_properties.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_properties (
  id                    CHAR(26)       NOT NULL,
  owner_id              VARCHAR(128)   NULL,
  organization_id       VARCHAR(128)   NULL,
  name                  VARCHAR(255)   NOT NULL,
  address               VARCHAR(512)   NOT NULL,
  interior_type         VARCHAR(128)   NOT NULL,
  shell_id              VARCHAR(128)   NULL,
  status                ENUM('available','owned','occupied','locked','breached','seized','abandoned')
                                       NOT NULL DEFAULT 'available',
  is_locked             TINYINT(1)     NOT NULL DEFAULT 0,
  alarm_state           ENUM('off','armed','triggered')
                                       NOT NULL DEFAULT 'off',
  storage_capacity      INT            NOT NULL DEFAULT 100,
  notes                 TEXT           NULL,
  seized_by_principal_id VARCHAR(128)  NULL,
  seized_at             DATETIME(3)    NULL,
  created_at            DATETIME(3)    NOT NULL,
  updated_at            DATETIME(3)    NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_prop_owner        (owner_id),
  INDEX idx_prop_org          (organization_id),
  INDEX idx_prop_status       (status),
  INDEX idx_prop_interior_type (interior_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 070_create_property_access.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_property_access (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  principal_id             VARCHAR(128)  NOT NULL,
  access_type              ENUM('owner','co_owner','tenant','guest','organization',
                                'emergency_ems','emergency_law')
                                         NOT NULL,
  granted_by_principal_id  VARCHAR(128)  NOT NULL,
  expires_at               DATETIME(3)   NULL,
  revoked_at               DATETIME(3)   NULL,
  revoked_by_principal_id  VARCHAR(128)  NULL,
  granted_at               DATETIME(3)   NOT NULL,

  PRIMARY KEY (id),
  INDEX idx_pa_property           (property_id),
  INDEX idx_pa_principal          (principal_id),
  INDEX idx_pa_active             (property_id, revoked_at),
  INDEX idx_pa_principal_active   (principal_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_property_keys (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  issued_to_principal_id   VARCHAR(128)  NOT NULL,
  issued_by_principal_id   VARCHAR(128)  NOT NULL,
  issued_at                DATETIME(3)   NOT NULL,
  revoked_at               DATETIME(3)   NULL,
  revoked_by_principal_id  VARCHAR(128)  NULL,

  PRIMARY KEY (id),
  INDEX idx_pk_property           (property_id),
  INDEX idx_pk_principal          (issued_to_principal_id),
  INDEX idx_pk_active             (property_id, issued_to_principal_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 071_create_property_storage.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_property_stashes (
  id               CHAR(26)     NOT NULL,
  property_id      CHAR(26)     NOT NULL,
  stash_id         VARCHAR(128) NOT NULL,
  label            VARCHAR(255) NOT NULL,
  stash_type       ENUM('personal','shared','evidence','medical','organization')
                                NOT NULL DEFAULT 'personal',
  owner_id         VARCHAR(128) NULL,
  organization_id  VARCHAR(128) NULL,
  capacity         INT          NOT NULL DEFAULT 50,
  is_locked        TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME(3)  NOT NULL,
  updated_at       DATETIME(3)  NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stash_id      (property_id, stash_id),
  INDEX idx_stash_property    (property_id),
  INDEX idx_stash_owner       (owner_id),
  INDEX idx_stash_org         (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_property_stash_items (
  id                      CHAR(26)      NOT NULL,
  stash_record_id         CHAR(26)      NOT NULL,
  item_name               VARCHAR(128)  NOT NULL,
  quantity                INT           NOT NULL DEFAULT 1,
  metadata                JSON          NULL,
  added_by_principal_id   VARCHAR(128)  NOT NULL,
  added_at                DATETIME(3)   NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_stash_item   (stash_record_id, item_name),
  INDEX idx_si_stash         (stash_record_id),
  CONSTRAINT fk_si_stash FOREIGN KEY (stash_record_id)
    REFERENCES atc_property_stashes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 072_create_property_garages.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_property_garages (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  garage_id                VARCHAR(128)  NOT NULL,
  label                    VARCHAR(255)  NOT NULL DEFAULT '',
  capacity                 INT           NOT NULL DEFAULT 4,
  linked_by_principal_id   VARCHAR(128)  NOT NULL,
  linked_at                DATETIME(3)   NOT NULL,
  unlinked_at              DATETIME(3)   NULL,
  unlinked_by_principal_id VARCHAR(128)  NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_prop_garage  (property_id, garage_id, unlinked_at),
  INDEX idx_pg_property      (property_id),
  INDEX idx_pg_garage        (garage_id),
  INDEX idx_pg_active        (property_id, unlinked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 073_create_property_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_property_runtime (
  id                       CHAR(26)      NOT NULL,
  property_id              CHAR(26)      NOT NULL,
  is_online                TINYINT(1)    NOT NULL DEFAULT 0,
  occupant_count           INT           NOT NULL DEFAULT 0,
  breach_started_at        DATETIME(3)   NULL,
  breach_by_principal_id   VARCHAR(128)  NULL,
  breach_reason            VARCHAR(512)  NULL,
  last_activity_at         DATETIME(3)   NOT NULL,
  created_at               DATETIME(3)   NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_rt_property  (property_id),
  INDEX idx_rt_online        (is_online),
  INDEX idx_rt_activity      (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_property_occupants (
  id             CHAR(26)      NOT NULL,
  property_id    CHAR(26)      NOT NULL,
  principal_id   VARCHAR(128)  NOT NULL,
  entered_at     DATETIME(3)   NOT NULL,
  exited_at      DATETIME(3)   NULL,

  PRIMARY KEY (id),
  INDEX idx_occ_property_active   (property_id, exited_at),
  INDEX idx_occ_principal         (principal_id, exited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 074_create_weapon_registry.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_weapon_registry (
  id                      CHAR(26)      NOT NULL,
  owner_id                VARCHAR(128)  NULL,
  organization_id         VARCHAR(128)  NULL,
  model                   VARCHAR(128)  NOT NULL,
  category                ENUM('pistol','rifle','shotgun','smg','sniper','melee','explosive','thrown','unarmed') NOT NULL,
  serial                  VARCHAR(64)   NOT NULL,
  durability              TINYINT UNSIGNED NOT NULL DEFAULT 100,
  is_locked               TINYINT(1)   NOT NULL DEFAULT 0,
  status                  ENUM('registered','active','lost','seized','destroyed') NOT NULL DEFAULT 'registered',
  registered_by_principal_id VARCHAR(128) NULL,
  seized_by_principal_id  VARCHAR(128)  NULL,
  seized_at               DATETIME(3)   NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_serial (serial),
  INDEX idx_owner (owner_id),
  INDEX idx_organization (organization_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 075_create_weapon_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_weapon_runtime (
  id                      CHAR(26)      NOT NULL,
  weapon_id               CHAR(26)      NOT NULL,
  holder_principal_id     VARCHAR(128)  NOT NULL,
  is_equipped             TINYINT(1)    NOT NULL DEFAULT 0,
  current_ammo            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_ammo                SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  attachment_state        JSON          NULL,
  equipped_at             DATETIME(3)   NULL,
  unequipped_at           DATETIME(3)   NULL,
  last_sync_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_weapon_holder (weapon_id, holder_principal_id),
  INDEX idx_holder (holder_principal_id),
  INDEX idx_equipped (is_equipped)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 076_create_damage_events.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_damage_events (
  id                      CHAR(26)      NOT NULL,
  session_id              CHAR(26)      NULL,
  attacker_principal_id   VARCHAR(128)  NOT NULL,
  victim_principal_id     VARCHAR(128)  NOT NULL,
  weapon_id               CHAR(26)      NULL,
  weapon_model            VARCHAR(128)  NOT NULL,
  hit_bone                ENUM('head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','back','unknown') NOT NULL DEFAULT 'unknown',
  damage_amount           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  mitigated_amount        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  net_damage              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  hit_x                   FLOAT         NULL,
  hit_y                   FLOAT         NULL,
  hit_z                   FLOAT         NULL,
  replay_nonce            VARCHAR(64)   NOT NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_replay_nonce (attacker_principal_id, victim_principal_id, replay_nonce),
  INDEX idx_session (session_id),
  INDEX idx_victim (victim_principal_id),
  INDEX idx_attacker (attacker_principal_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 077_create_combat_sessions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_combat_sessions (
  id                      CHAR(26)      NOT NULL,
  initiator_principal_id  VARCHAR(128)  NOT NULL,
  status                  ENUM('active','ended','abandoned') NOT NULL DEFAULT 'active',
  outcome                 VARCHAR(256)  NULL,
  started_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at                DATETIME(3)   NULL,
  participant_count       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_initiator (initiator_principal_id),
  INDEX idx_status (status),
  INDEX idx_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 078_create_ballistics.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_ballistics (
  id                      CHAR(26)      NOT NULL,
  damage_event_id         CHAR(26)      NOT NULL,
  velocity                FLOAT         NULL,
  distance                FLOAT         NULL,
  impact_angle            FLOAT         NULL,
  penetration_data        VARCHAR(512)  NULL,
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_damage_event (damage_event_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 079_create_injury_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_injury_runtime (
  id                      CHAR(26)      NOT NULL,
  principal_id            VARCHAR(128)  NOT NULL,
  body_region             ENUM('head','chest','abdomen','left_arm','right_arm','left_leg','right_leg','back','unknown') NOT NULL,
  severity                ENUM('minor','moderate','severe','critical','fatal') NOT NULL,
  source_damage_event_id  CHAR(26)      NULL,
  applied_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at             DATETIME(3)   NULL,
  PRIMARY KEY (id),
  INDEX idx_principal (principal_id),
  INDEX idx_active (principal_id, resolved_at),
  INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 080_create_gangs.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_gangs (
  id                      CHAR(26)     NOT NULL,
  name                    VARCHAR(64)  NOT NULL,
  tag                     VARCHAR(8)   NOT NULL,
  leader_principal_id     VARCHAR(128) NOT NULL,
  territory_id            VARCHAR(128) NULL,
  status                  ENUM('active','disbanded','suspended') NOT NULL DEFAULT 'active',
  member_count            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tag (tag),
  INDEX idx_leader (leader_principal_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 081_create_gang_members.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_gang_members (
  id                      CHAR(26)     NOT NULL,
  gang_id                 CHAR(26)     NOT NULL,
  principal_id            VARCHAR(128) NOT NULL,
  rank                    ENUM('leader','officer','member','associate') NOT NULL DEFAULT 'associate',
  invited_by_principal_id VARCHAR(128) NULL,
  joined_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at                 DATETIME(3)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_active_member (gang_id, principal_id, left_at),
  INDEX idx_gang (gang_id),
  INDEX idx_principal (principal_id),
  INDEX idx_active (gang_id, left_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 082_create_criminal_operations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_criminal_operations (
  id                      CHAR(26)     NOT NULL,
  label                   VARCHAR(255) NOT NULL,
  operation_type          ENUM('heist','drug_run','smuggling','extortion','assassination','theft','other') NOT NULL,
  owner_principal_id      VARCHAR(128) NOT NULL,
  gang_id                 CHAR(26)     NULL,
  status                  ENUM('planning','active','completed','failed','aborted') NOT NULL DEFAULT 'planning',
  started_at              DATETIME(3)  NULL,
  ended_at                DATETIME(3)  NULL,
  outcome                 VARCHAR(512) NULL,
  metadata                JSON         NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_owner (owner_principal_id),
  INDEX idx_gang (gang_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 083_create_contraband.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_contraband (
  id                      CHAR(26)     NOT NULL,
  property_id             VARCHAR(128) NULL,
  stash_id                VARCHAR(128) NULL,
  item_name               VARCHAR(128) NOT NULL,
  quantity                INT UNSIGNED NOT NULL DEFAULT 1,
  status                  ENUM('registered','seized','destroyed') NOT NULL DEFAULT 'registered',
  registered_by_principal_id VARCHAR(128) NOT NULL,
  seized_by_principal_id  VARCHAR(128) NULL,
  seized_at               DATETIME(3)  NULL,
  registered_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_property (property_id),
  INDEX idx_status (status),
  INDEX idx_item (item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 084_create_black_market_transactions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_black_market_transactions (
  id                      CHAR(26)     NOT NULL,
  seller_principal_id     VARCHAR(128) NOT NULL,
  buyer_principal_id      VARCHAR(128) NOT NULL,
  item_name               VARCHAR(128) NOT NULL,
  quantity                INT UNSIGNED NOT NULL DEFAULT 1,
  price                   INT UNSIGNED NOT NULL DEFAULT 0,
  location_label          VARCHAR(255) NULL,
  completed_at            DATETIME(3)  NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_seller (seller_principal_id),
  INDEX idx_buyer (buyer_principal_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 085_create_raids.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_raids (
  id                      CHAR(26)     NOT NULL,
  property_id             VARCHAR(128) NOT NULL,
  initiating_agency_id    VARCHAR(128) NULL,
  lead_principal_id       VARCHAR(128) NOT NULL,
  status                  ENUM('staging','active','completed','aborted') NOT NULL DEFAULT 'staging',
  outcome                 ENUM('success','failure','partial','aborted') NULL,
  participants            JSON         NOT NULL,
  started_at              DATETIME(3)  NULL,
  ended_at                DATETIME(3)  NULL,
  notes                   TEXT         NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_property (property_id),
  INDEX idx_lead (lead_principal_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 086_create_world_entities.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_world_entities (
  id                      CHAR(26)     NOT NULL,
  entity_type             ENUM('vehicle','object','ped','pickup','blip','zone','other') NOT NULL,
  owner_principal_id      VARCHAR(128) NULL,
  network_id              INT          NULL,
  model                   VARCHAR(128) NOT NULL,
  x                       FLOAT        NOT NULL DEFAULT 0,
  y                       FLOAT        NOT NULL DEFAULT 0,
  z                       FLOAT        NOT NULL DEFAULT 0,
  heading                 FLOAT        NOT NULL DEFAULT 0,
  spawn_nonce             VARCHAR(64)  NOT NULL,
  status                  ENUM('registered','active','despawned','cleanup_pending','cleaned') NOT NULL DEFAULT 'registered',
  scene_id                VARCHAR(128) NULL,
  spawned_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  despawned_at            DATETIME(3)  NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_spawn_nonce (owner_principal_id, spawn_nonce),
  INDEX idx_owner (owner_principal_id),
  INDEX idx_scene (scene_id),
  INDEX idx_status (status),
  INDEX idx_network (network_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 087_create_scene_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_scene_runtime (
  id                      CHAR(26)     NOT NULL,
  scene_id                VARCHAR(128) NOT NULL,
  creator_principal_id    VARCHAR(128) NOT NULL,
  label                   VARCHAR(255) NOT NULL,
  is_locked               TINYINT(1)   NOT NULL DEFAULT 0,
  status                  ENUM('active','suspended','destroyed','cleanup_pending') NOT NULL DEFAULT 'active',
  replication_node        VARCHAR(128) NULL,
  entity_count            SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_scene_id (scene_id),
  INDEX idx_creator (creator_principal_id),
  INDEX idx_status (status),
  INDEX idx_node (replication_node)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 088_create_entity_ownership.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_entity_ownership (
  id                      CHAR(26)     NOT NULL,
  entity_id               CHAR(26)     NOT NULL,
  scene_id                VARCHAR(128) NULL,
  principal_id            VARCHAR(128) NOT NULL,
  acquired_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at             DATETIME(3)  NULL,
  PRIMARY KEY (id),
  INDEX idx_entity (entity_id),
  INDEX idx_principal (principal_id),
  INDEX idx_active (entity_id, released_at),
  INDEX idx_scene (scene_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 089_create_persistent_scenes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_persistent_scenes (
  id                      CHAR(26)     NOT NULL,
  scene_id                VARCHAR(128) NOT NULL,
  scene_type              ENUM('crime_scene','accident','blockade','event','construction','other') NOT NULL,
  world_region            VARCHAR(128) NULL,
  data                    JSON         NOT NULL,
  persisted_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at              DATETIME(3)  NULL,
  restored_at             DATETIME(3)  NULL,
  PRIMARY KEY (id),
  INDEX idx_scene_id (scene_id),
  INDEX idx_type (scene_type),
  INDEX idx_expires (expires_at),
  INDEX idx_region (world_region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 090_create_runtime_cleanup.sql
-- ---------------------------------------------------------------------------
CREATE TABLE atc_runtime_cleanup (
  id                      CHAR(26)     NOT NULL,
  target_type             VARCHAR(64)  NOT NULL,
  target_id               VARCHAR(128) NOT NULL,
  cleanup_reason          ENUM('timeout','manual','server_restart','owner_disconnect','scene_destroyed') NOT NULL,
  scheduled_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at            DATETIME(3)  NULL,
  node_id                 VARCHAR(128) NULL,
  PRIMARY KEY (id),
  INDEX idx_target (target_type, target_id),
  INDEX idx_pending (completed_at),
  INDEX idx_node (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 091_create_vehicle_fuel.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_fuel (
  id                 VARCHAR(26)    NOT NULL,
  vehicle_runtime_id VARCHAR(26)    NOT NULL,
  tank_capacity      DECIMAL(10,2)  NOT NULL DEFAULT 60.00,
  current_fuel       DECIMAL(10,2)  NOT NULL DEFAULT 60.00,
  fuel_grade         ENUM('regular','premium','diesel','electric') NOT NULL DEFAULT 'regular',
  consumption_rate   DECIMAL(8,4)   NOT NULL DEFAULT 0.0500,
  last_refuel_at     DATETIME(3)    NULL,
  last_sync_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_fuel_runtime_id (vehicle_runtime_id),
  INDEX idx_vehicle_fuel_last_sync (last_sync_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 092_create_vehicle_damage_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_damage_runtime (
  id                  VARCHAR(26)  NOT NULL,
  vehicle_runtime_id  VARCHAR(26)  NOT NULL,
  engine_health       DECIMAL(7,2) NOT NULL DEFAULT 1000.00,
  body_health         DECIMAL(7,2) NOT NULL DEFAULT 1000.00,
  fuel_tank_health    DECIMAL(7,2) NOT NULL DEFAULT 1000.00,
  panel_damage        JSON         NOT NULL,
  tire_state          JSON         NOT NULL,
  is_engine_destroyed TINYINT(1)   NOT NULL DEFAULT 0,
  is_on_fire          TINYINT(1)   NOT NULL DEFAULT 0,
  last_sync_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_damage_runtime_vehicle (vehicle_runtime_id),
  INDEX idx_damage_on_fire (is_on_fire)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 093_create_vehicle_registrations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_registrations (
  id                     VARCHAR(26)  NOT NULL,
  vehicle_id             VARCHAR(26)  NOT NULL,
  owner_principal_id     VARCHAR(26)  NOT NULL,
  plate                  VARCHAR(16)  NOT NULL,
  status                 ENUM('active','expired','suspended','revoked') NOT NULL DEFAULT 'active',
  registered_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at             DATETIME(3)  NOT NULL,
  renewed_at             DATETIME(3)  NULL,
  suspended_at           DATETIME(3)  NULL,
  revoked_at             DATETIME(3)  NULL,
  revoked_by_principal_id VARCHAR(26) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_registrations_plate (plate),
  INDEX idx_vehicle_reg_vehicle_id (vehicle_id),
  INDEX idx_vehicle_reg_owner (owner_principal_id),
  INDEX idx_vehicle_reg_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 094_create_vehicle_traffic_violations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_traffic_violations (
  id                       VARCHAR(26)  NOT NULL,
  vehicle_id               VARCHAR(26)  NOT NULL,
  vehicle_runtime_id       VARCHAR(26)  NULL,
  principal_id             VARCHAR(26)  NOT NULL,
  violation_type           ENUM('speeding','reckless_driving','running_red_light','wrong_way','illegal_parking','hit_and_run','dui','other') NOT NULL,
  speed_recorded           DECIMAL(7,2) NULL,
  speed_limit              DECIMAL(7,2) NULL,
  location_x               FLOAT        NULL,
  location_y               FLOAT        NULL,
  location_z               FLOAT        NULL,
  recorded_by_principal_id VARCHAR(26)  NULL,
  fine_amount              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  is_paid                  TINYINT(1)   NOT NULL DEFAULT 0,
  paid_at                  DATETIME(3)  NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_violation_principal (principal_id),
  INDEX idx_violation_vehicle (vehicle_id),
  INDEX idx_violation_is_paid (is_paid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 095_create_vehicle_pursuits.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_pursuits (
  id                             VARCHAR(26)  NOT NULL,
  vehicle_runtime_id             VARCHAR(26)  NOT NULL,
  suspect_principal_id           VARCHAR(26)  NOT NULL,
  initiating_officer_principal_id VARCHAR(26) NOT NULL,
  initiating_agency_id           VARCHAR(26)  NULL,
  status                         ENUM('active','ended','escaped','terminated') NOT NULL DEFAULT 'active',
  pursuit_nonce                  VARCHAR(128) NOT NULL,
  start_location_x               FLOAT        NULL,
  start_location_y               FLOAT        NULL,
  start_location_z               FLOAT        NULL,
  end_location_x                 FLOAT        NULL,
  end_location_y                 FLOAT        NULL,
  end_location_z                 FLOAT        NULL,
  started_at                     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at                       DATETIME(3)  NULL,
  notes                          TEXT         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pursuit_nonce (pursuit_nonce),
  INDEX idx_pursuit_vehicle_runtime (vehicle_runtime_id),
  INDEX idx_pursuit_suspect (suspect_principal_id),
  INDEX idx_pursuit_status (status),
  INDEX idx_pursuit_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 096_create_vehicle_runtime_metrics.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vehicle_runtime_metrics (
  id                      VARCHAR(26)  NOT NULL,
  vehicle_runtime_id      VARCHAR(26)  NOT NULL,
  distance_traveled       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  top_speed_recorded      DECIMAL(7,2)  NOT NULL DEFAULT 0.00,
  total_collisions        INT UNSIGNED  NOT NULL DEFAULT 0,
  engine_runtime_minutes  INT UNSIGNED  NOT NULL DEFAULT 0,
  last_heartbeat_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_metrics_vehicle (vehicle_runtime_id),
  INDEX idx_runtime_metrics_heartbeat (last_heartbeat_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 097_create_bank_accounts.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_bank_accounts (
  id                      VARCHAR(26)  NOT NULL,
  principal_id            VARCHAR(26)  NOT NULL,
  account_type            ENUM('personal','business','government','escrow') NOT NULL DEFAULT 'personal',
  balance                 BIGINT       NOT NULL DEFAULT 0,
  is_frozen               TINYINT(1)   NOT NULL DEFAULT 0,
  frozen_at               DATETIME(3)  NULL,
  frozen_by_principal_id  VARCHAR(26)  NULL,
  freeze_reason           VARCHAR(500) NULL,
  created_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bank_account_principal_type (principal_id, account_type),
  INDEX idx_bank_account_principal (principal_id),
  INDEX idx_bank_account_frozen (is_frozen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 098_create_bank_transactions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_bank_transactions (
  id                VARCHAR(26)   NOT NULL,
  from_account_id   VARCHAR(26)   NULL,
  to_account_id     VARCHAR(26)   NULL,
  transaction_type  ENUM('transfer','deposit','withdrawal','tax','refund','auction_payment','marketplace_payment','escrow_in','escrow_out') NOT NULL,
  amount            BIGINT        NOT NULL,
  idempotency_key   VARCHAR(128)  NOT NULL,
  description       VARCHAR(500)  NULL,
  metadata          JSON          NULL,
  status            ENUM('pending','completed','failed','reversed') NOT NULL DEFAULT 'pending',
  completed_at      DATETIME(3)   NULL,
  failed_at         DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bank_tx_idempotency (idempotency_key),
  INDEX idx_bank_tx_from (from_account_id),
  INDEX idx_bank_tx_to (to_account_id),
  INDEX idx_bank_tx_status (status),
  INDEX idx_bank_tx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 099_create_market_listings.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_market_listings (
  id                   VARCHAR(26)   NOT NULL,
  seller_principal_id  VARCHAR(26)   NOT NULL,
  item_name            VARCHAR(255)  NOT NULL,
  item_category        VARCHAR(128)  NULL,
  quantity             INT UNSIGNED  NOT NULL DEFAULT 1,
  price_per_unit       BIGINT        NOT NULL,
  total_price          BIGINT        NOT NULL,
  description          TEXT          NULL,
  status               ENUM('active','sold','cancelled','expired') NOT NULL DEFAULT 'active',
  listing_nonce        VARCHAR(128)  NOT NULL,
  buyer_principal_id   VARCHAR(26)   NULL,
  sold_at              DATETIME(3)   NULL,
  expires_at           DATETIME(3)   NOT NULL,
  created_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_listing_nonce (listing_nonce),
  INDEX idx_listing_seller (seller_principal_id),
  INDEX idx_listing_status_expires (status, expires_at),
  INDEX idx_listing_category (item_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 100_create_market_auctions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_market_auctions (
  id                          VARCHAR(26)   NOT NULL,
  seller_principal_id         VARCHAR(26)   NOT NULL,
  item_name                   VARCHAR(255)  NOT NULL,
  item_category               VARCHAR(128)  NULL,
  quantity                    INT UNSIGNED  NOT NULL DEFAULT 1,
  starting_bid                BIGINT        NOT NULL,
  minimum_bid_increment       BIGINT        NOT NULL DEFAULT 1,
  current_bid                 BIGINT        NOT NULL,
  current_bidder_principal_id VARCHAR(26)   NULL,
  reserve_price               BIGINT        NULL,
  status                      ENUM('active','completed','cancelled','no_sale') NOT NULL DEFAULT 'active',
  auction_nonce               VARCHAR(128)  NOT NULL,
  ends_at                     DATETIME(3)   NOT NULL,
  completed_at                DATETIME(3)   NULL,
  created_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_auction_nonce (auction_nonce),
  INDEX idx_auction_seller (seller_principal_id),
  INDEX idx_auction_status_ends (status, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 101_create_tax_records.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_tax_records (
  id                    VARCHAR(26)  NOT NULL,
  principal_id          VARCHAR(26)  NOT NULL,
  tax_type              ENUM('income','property','transaction','import','fine') NOT NULL,
  amount                BIGINT       NOT NULL,
  source_transaction_id VARCHAR(26)  NULL,
  period_label          VARCHAR(64)  NULL,
  status                ENUM('pending','collected','waived','disputed') NOT NULL DEFAULT 'pending',
  collected_at          DATETIME(3)  NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_tax_record_principal (principal_id),
  INDEX idx_tax_record_status (status),
  INDEX idx_tax_record_type (tax_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 102_create_financial_flags.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_financial_flags (
  id                       VARCHAR(26)  NOT NULL,
  principal_id             VARCHAR(26)  NOT NULL,
  flag_type                ENUM('suspicious_transfer','velocity_breach','structuring','large_withdrawal','unusual_pattern','manual_review') NOT NULL,
  severity                 ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  amount_involved          BIGINT       NULL,
  transaction_id           VARCHAR(26)  NULL,
  description              VARCHAR(1000) NOT NULL,
  is_resolved              TINYINT(1)   NOT NULL DEFAULT 0,
  resolved_at              DATETIME(3)  NULL,
  resolved_by_principal_id VARCHAR(26)  NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_financial_flag_principal (principal_id),
  INDEX idx_financial_flag_severity_resolved (severity, is_resolved),
  INDEX idx_financial_flag_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 103_create_factions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_factions (
  id                   VARCHAR(26)   NOT NULL,
  name                 VARCHAR(128)  NOT NULL,
  tag                  VARCHAR(8)    NOT NULL,
  leader_principal_id  VARCHAR(26)   NOT NULL,
  faction_type         ENUM('gang','police','military','government','civilian','other') NOT NULL DEFAULT 'gang',
  status               ENUM('active','disbanded','suspended') NOT NULL DEFAULT 'active',
  member_count         INT UNSIGNED  NOT NULL DEFAULT 1,
  color_hex            CHAR(7)       NULL,
  description          TEXT          NULL,
  territory_count      INT UNSIGNED  NOT NULL DEFAULT 0,
  created_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_faction_tag (tag),
  UNIQUE KEY uq_faction_name (name),
  INDEX idx_faction_type_status (faction_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 104_create_territories.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_territories (
  id                    VARCHAR(26)   NOT NULL,
  territory_id          VARCHAR(128)  NOT NULL,
  label                 VARCHAR(255)  NOT NULL,
  territory_type        ENUM('district','zone','building','intersection','highway','port','airport','other') NOT NULL DEFAULT 'zone',
  controlling_faction_id VARCHAR(26)  NULL,
  influence_level       INT           NOT NULL DEFAULT 0,
  is_contested          TINYINT(1)    NOT NULL DEFAULT 0,
  center_x              FLOAT         NULL,
  center_y              FLOAT         NULL,
  center_z              FLOAT         NULL,
  radius                FLOAT         NULL,
  tax_rate              DECIMAL(5,4)  NOT NULL DEFAULT 0.0500,
  last_capture_at       DATETIME(3)   NULL,
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_territory_id (territory_id),
  INDEX idx_territory_controlling_faction (controlling_faction_id),
  INDEX idx_territory_contested (is_contested)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 105_create_territory_claims.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_territory_claims (
  id                      VARCHAR(26)   NOT NULL,
  territory_id            VARCHAR(26)   NOT NULL,
  faction_id              VARCHAR(26)   NOT NULL,
  claimed_by_principal_id VARCHAR(26)   NOT NULL,
  claim_type              ENUM('capture','purchase','grant','inheritance') NOT NULL,
  status                  ENUM('active','superseded','released') NOT NULL DEFAULT 'active',
  claim_nonce             VARCHAR(128)  NOT NULL,
  claimed_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at             DATETIME(3)   NULL,
  superseded_at           DATETIME(3)   NULL,
  notes                   TEXT          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_territory_claim_nonce (claim_nonce),
  INDEX idx_territory_claim_territory_status (territory_id, status),
  INDEX idx_territory_claim_faction (faction_id),
  INDEX idx_territory_claim_claimed_at (claimed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 106_create_faction_conflicts.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_faction_conflicts (
  id                      VARCHAR(26)   NOT NULL,
  territory_id            VARCHAR(26)   NOT NULL,
  attacker_faction_id     VARCHAR(26)   NOT NULL,
  defender_faction_id     VARCHAR(26)   NULL,
  initiating_principal_id VARCHAR(26)   NOT NULL,
  conflict_type           ENUM('territory_capture','resource_dispute','retaliation','war','skirmish') NOT NULL,
  status                  ENUM('active','resolved','aborted','stalemate') NOT NULL DEFAULT 'active',
  outcome                 ENUM('attacker_won','defender_won','stalemate','aborted') NULL,
  conflict_nonce          VARCHAR(128)  NOT NULL,
  participants            JSON          NOT NULL,
  started_at              DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at                DATETIME(3)   NULL,
  notes                   TEXT          NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conflict_nonce (conflict_nonce),
  INDEX idx_conflict_territory_status (territory_id, status),
  INDEX idx_conflict_attacker (attacker_faction_id),
  INDEX idx_conflict_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 107_create_resource_nodes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_resource_nodes (
  id                    VARCHAR(26)   NOT NULL,
  node_id               VARCHAR(128)  NOT NULL,
  label                 VARCHAR(255)  NOT NULL,
  node_type             ENUM('mine','oil_field','farm','dock','warehouse','lab','safehouse','other') NOT NULL DEFAULT 'other',
  controlling_faction_id VARCHAR(26)  NULL,
  yield_rate            DECIMAL(8,4)  NOT NULL DEFAULT 1.0000,
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  center_x              FLOAT         NULL,
  center_y              FLOAT         NULL,
  center_z              FLOAT         NULL,
  last_captured_at      DATETIME(3)   NULL,
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_resource_node_id (node_id),
  INDEX idx_resource_node_faction (controlling_faction_id),
  INDEX idx_resource_node_type_active (node_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 108_create_influence_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_influence_runtime (
  id               VARCHAR(26)    NOT NULL,
  faction_id       VARCHAR(26)    NOT NULL,
  territory_id     VARCHAR(26)    NOT NULL,
  influence_score  INT            NOT NULL DEFAULT 0,
  influence_delta  INT            NOT NULL DEFAULT 0,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decay_rate       DECIMAL(5,4)   NOT NULL DEFAULT 0.0100,
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_influence_faction_territory (faction_id, territory_id),
  INDEX idx_influence_territory (territory_id),
  INDEX idx_influence_score (influence_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 109_create_rental_contracts.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_rental_contracts (
  id                   VARCHAR(26)    NOT NULL,
  property_id          VARCHAR(128)   NOT NULL,
  tenant_principal_id  VARCHAR(128)   NOT NULL,
  landlord_principal_id VARCHAR(128)  NOT NULL,
  rent_amount          VARCHAR(24)    NOT NULL DEFAULT '0',
  deposit_amount       VARCHAR(24)    NOT NULL DEFAULT '0',
  rent_cycle_days      INT            NOT NULL DEFAULT 30,
  start_date           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  end_date             DATETIME(3)    NULL,
  last_payment_at      DATETIME(3)    NULL,
  next_payment_due_at  DATETIME(3)    NOT NULL,
  status               VARCHAR(32)    NOT NULL DEFAULT 'active',
  contract_nonce       VARCHAR(128)   NOT NULL,
  notes                TEXT           NULL,
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_rental_contract_nonce (contract_nonce),
  INDEX idx_rental_property (property_id),
  INDEX idx_rental_tenant (tenant_principal_id),
  INDEX idx_rental_status (status),
  INDEX idx_rental_next_payment (next_payment_due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 110_create_property_taxes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_property_taxes (
  id                      VARCHAR(26)    NOT NULL,
  property_id             VARCHAR(128)   NOT NULL,
  principal_id            VARCHAR(128)   NOT NULL,
  amount                  VARCHAR(24)    NOT NULL DEFAULT '0',
  period_label            VARCHAR(64)    NOT NULL,
  status                  VARCHAR(32)    NOT NULL DEFAULT 'assessed',
  assessed_at             DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  due_at                  DATETIME(3)    NOT NULL,
  paid_at                 DATETIME(3)    NULL,
  paid_by_principal_id    VARCHAR(128)   NULL,
  created_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_property_tax_period (property_id, period_label),
  INDEX idx_tax_property (property_id),
  INDEX idx_tax_principal (principal_id),
  INDEX idx_tax_status (status),
  INDEX idx_tax_due (due_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 111_create_asset_valuations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_asset_valuations (
  id                      VARCHAR(26)    NOT NULL,
  property_id             VARCHAR(128)   NOT NULL,
  valued_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  valuation_amount        VARCHAR(24)    NOT NULL DEFAULT '0',
  previous_amount         VARCHAR(24)    NULL,
  valued_by_principal_id  VARCHAR(128)   NULL,
  method                  VARCHAR(64)    NOT NULL DEFAULT 'manual',
  notes                   TEXT           NULL,
  created_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_valuation_property (property_id),
  INDEX idx_valuation_valued_at (valued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 112_create_foreclosures.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_foreclosures (
  id                      VARCHAR(26)    NOT NULL,
  property_id             VARCHAR(128)   NOT NULL,
  contract_id             VARCHAR(26)    NULL,
  initiated_by_principal_id VARCHAR(128) NOT NULL,
  status                  VARCHAR(32)    NOT NULL DEFAULT 'initiated',
  reason                  VARCHAR(500)   NOT NULL,
  foreclosure_nonce       VARCHAR(128)   NOT NULL,
  initiated_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at            DATETIME(3)    NULL,
  cancelled_at            DATETIME(3)    NULL,
  notes                   TEXT           NULL,
  created_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_foreclosure_nonce (foreclosure_nonce),
  INDEX idx_foreclosure_property (property_id),
  INDEX idx_foreclosure_status (status),
  INDEX idx_foreclosure_initiated_at (initiated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 113_create_tenant_history.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_tenant_history (
  id                        VARCHAR(26)    NOT NULL,
  contract_id               VARCHAR(26)    NOT NULL,
  property_id               VARCHAR(128)   NOT NULL,
  tenant_principal_id       VARCHAR(128)   NOT NULL,
  action                    VARCHAR(64)    NOT NULL,
  performed_by_principal_id VARCHAR(128)   NULL,
  notes                     TEXT           NULL,
  created_at                DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_tenant_history_contract (contract_id),
  INDEX idx_tenant_history_property (property_id),
  INDEX idx_tenant_history_tenant (tenant_principal_id),
  INDEX idx_tenant_history_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 114_create_housing_payments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_housing_payments (
  id                  VARCHAR(26)    NOT NULL,
  contract_id         VARCHAR(26)    NULL,
  from_principal_id   VARCHAR(128)   NOT NULL,
  to_principal_id     VARCHAR(128)   NOT NULL,
  amount              VARCHAR(24)    NOT NULL DEFAULT '0',
  payment_type        VARCHAR(32)    NOT NULL DEFAULT 'rent',
  status              VARCHAR(32)    NOT NULL DEFAULT 'pending',
  idempotency_key     VARCHAR(128)   NOT NULL,
  description         VARCHAR(500)   NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at        DATETIME(3)    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_housing_payment_idempotency (idempotency_key),
  INDEX idx_housing_payment_contract (contract_id),
  INDEX idx_housing_payment_from (from_principal_id),
  INDEX idx_housing_payment_status (status),
  INDEX idx_housing_payment_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 115_create_npc_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_npc_runtime (
  id                   VARCHAR(26)    NOT NULL,
  spawn_nonce          VARCHAR(128)   NOT NULL,
  npc_type             VARCHAR(32)    NOT NULL DEFAULT 'civilian',
  model_hash           VARCHAR(128)   NULL,
  owner_server_id      VARCHAR(128)   NULL,
  zone_id              VARCHAR(128)   NULL,
  position_x           FLOAT          NULL,
  position_y           FLOAT          NULL,
  position_z           FLOAT          NULL,
  status               VARCHAR(32)    NOT NULL DEFAULT 'spawned',
  spawned_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  despawned_at         DATETIME(3)    NULL,
  last_heartbeat_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata             JSON           NULL,
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_npc_spawn_nonce (spawn_nonce),
  INDEX idx_npc_status (status),
  INDEX idx_npc_owner (owner_server_id),
  INDEX idx_npc_zone (zone_id),
  INDEX idx_npc_heartbeat (last_heartbeat_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 116_create_population_zones.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_population_zones (
  id                   VARCHAR(26)    NOT NULL,
  zone_id              VARCHAR(128)   NOT NULL,
  zone_name            VARCHAR(255)   NOT NULL,
  max_population       INT            NOT NULL DEFAULT 50,
  current_population   INT            NOT NULL DEFAULT 0,
  density_multiplier   FLOAT          NOT NULL DEFAULT 1.0,
  is_active            TINYINT(1)     NOT NULL DEFAULT 1,
  last_tick_at         DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_population_zone_id (zone_id),
  INDEX idx_pop_zone_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 117_create_npc_behaviors.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_npc_behaviors (
  id          VARCHAR(26)    NOT NULL,
  npc_id      VARCHAR(26)    NOT NULL,
  behavior    VARCHAR(128)   NOT NULL,
  params      JSON           NULL,
  started_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at    DATETIME(3)    NULL,
  created_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_npc_behavior_npc (npc_id),
  INDEX idx_npc_behavior_active (npc_id, ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 118_create_npc_spawn_points.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_npc_spawn_points (
  id            VARCHAR(26)    NOT NULL,
  zone_id       VARCHAR(128)   NOT NULL,
  position_x    FLOAT          NOT NULL DEFAULT 0,
  position_y    FLOAT          NOT NULL DEFAULT 0,
  position_z    FLOAT          NOT NULL DEFAULT 0,
  heading       FLOAT          NOT NULL DEFAULT 0,
  spawn_type    VARCHAR(64)    NOT NULL DEFAULT 'ambient',
  is_enabled    TINYINT(1)     NOT NULL DEFAULT 1,
  last_used_at  DATETIME(3)    NULL,
  created_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_spawn_point_zone (zone_id),
  INDEX idx_spawn_point_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 119_create_crowd_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_crowd_runtime (
  id               VARCHAR(26)    NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  density          FLOAT          NOT NULL DEFAULT 0.0,
  target_density   FLOAT          NOT NULL DEFAULT 0.5,
  active_npc_count INT            NOT NULL DEFAULT 0,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crowd_zone (zone_id),
  INDEX idx_crowd_density (density)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 120_create_npc_cleanup.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_npc_cleanup (
  id               VARCHAR(26)    NOT NULL,
  npc_id           VARCHAR(26)    NOT NULL,
  cleanup_reason   VARCHAR(128)   NOT NULL,
  owner_server_id  VARCHAR(128)   NULL,
  cleaned_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_npc_cleanup_npc (npc_id),
  INDEX idx_npc_cleanup_cleaned_at (cleaned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 121_create_city_infrastructure.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_city_infrastructure (
  id                    VARCHAR(26)    NOT NULL,
  node_id               VARCHAR(128)   NOT NULL,
  node_name             VARCHAR(255)   NOT NULL,
  infrastructure_type   VARCHAR(64)    NOT NULL DEFAULT 'other',
  status                VARCHAR(32)    NOT NULL DEFAULT 'operational',
  owner_server_id       VARCHAR(128)   NULL,
  position_x            FLOAT          NULL,
  position_y            FLOAT          NULL,
  position_z            FLOAT          NULL,
  health_percent        FLOAT          NOT NULL DEFAULT 100.0,
  last_tick_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infra_node_id (node_id),
  INDEX idx_infra_status (status),
  INDEX idx_infra_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 122_create_utility_grids.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_utility_grids (
  id               VARCHAR(26)    NOT NULL,
  grid_id          VARCHAR(128)   NOT NULL,
  grid_type        VARCHAR(64)    NOT NULL DEFAULT 'power',
  status           VARCHAR(32)    NOT NULL DEFAULT 'online',
  capacity         FLOAT          NOT NULL DEFAULT 100.0,
  current_load     FLOAT          NOT NULL DEFAULT 0.0,
  owner_server_id  VARCHAR(128)   NULL,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_grid_id (grid_id),
  INDEX idx_utility_grid_type (grid_type),
  INDEX idx_utility_grid_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 123_create_resource_consumption.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_resource_consumption (
  id               VARCHAR(26)    NOT NULL,
  consumer_id      VARCHAR(128)   NOT NULL,
  consumer_type    VARCHAR(64)    NOT NULL DEFAULT 'building',
  grid_id          VARCHAR(128)   NOT NULL,
  resource_type    VARCHAR(64)    NOT NULL DEFAULT 'power',
  amount           FLOAT          NOT NULL DEFAULT 0.0,
  recorded_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_resource_consumer (consumer_id),
  INDEX idx_resource_grid (grid_id),
  INDEX idx_resource_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 124_create_traffic_signals.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_traffic_signals (
  id               VARCHAR(26)    NOT NULL,
  signal_id        VARCHAR(128)   NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  state            VARCHAR(32)    NOT NULL DEFAULT 'green',
  cycle_duration   INT            NOT NULL DEFAULT 30,
  is_overridden    TINYINT(1)     NOT NULL DEFAULT 0,
  override_by      VARCHAR(128)   NULL,
  override_until   DATETIME(3)    NULL,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_traffic_signal_id (signal_id),
  INDEX idx_traffic_zone (zone_id),
  INDEX idx_traffic_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 125_create_environment_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_environment_runtime (
  id               VARCHAR(26)    NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  weather_state    VARCHAR(64)    NOT NULL DEFAULT 'clear',
  temperature      FLOAT          NOT NULL DEFAULT 20.0,
  wind_speed       FLOAT          NOT NULL DEFAULT 0.0,
  wind_direction   FLOAT          NOT NULL DEFAULT 0.0,
  visibility       FLOAT          NOT NULL DEFAULT 1.0,
  is_night         TINYINT(1)     NOT NULL DEFAULT 0,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_environment_zone (zone_id),
  INDEX idx_environment_weather (weather_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 126_create_infrastructure_failures.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_infrastructure_failures (
  id                VARCHAR(26)    NOT NULL,
  infrastructure_id VARCHAR(26)    NOT NULL,
  failure_nonce     VARCHAR(128)   NOT NULL,
  failure_type      VARCHAR(64)    NOT NULL DEFAULT 'degraded',
  severity          VARCHAR(32)    NOT NULL DEFAULT 'minor',
  description       TEXT           NULL,
  detected_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at       DATETIME(3)    NULL,
  resolved_by       VARCHAR(128)   NULL,
  created_at        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infra_failure_nonce (failure_nonce),
  INDEX idx_infra_failure_infra (infrastructure_id),
  INDEX idx_infra_failure_severity (severity),
  INDEX idx_infra_failure_resolved (resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 127_create_survival_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_survival_runtime (
  id              VARCHAR(26)   NOT NULL,
  player_id       VARCHAR(128)  NOT NULL,
  body_temp       DECIMAL(5,2)  NOT NULL DEFAULT 37.00,
  hydration_level DECIMAL(5,2)  NOT NULL DEFAULT 100.00,
  fatigue_level   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  survival_status VARCHAR(32)   NOT NULL DEFAULT 'normal',
  penalty_flags   TEXT          NOT NULL DEFAULT '[]',
  owner_server_id VARCHAR(128)  NULL,
  last_tick_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_survival_player (player_id),
  INDEX idx_survival_status (survival_status),
  INDEX idx_survival_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 128_create_temperature_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_temperature_runtime (
  id            VARCHAR(26)   NOT NULL,
  player_id     VARCHAR(128)  NOT NULL,
  current_temp  DECIMAL(5,2)  NOT NULL DEFAULT 37.00,
  temp_trend    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  exposure_zone VARCHAR(128)  NULL,
  last_tick_at  DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_temp_player (player_id),
  INDEX idx_temp_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 129_create_environmental_exposure.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_environmental_exposure (
  id            VARCHAR(26)   NOT NULL,
  player_id     VARCHAR(128)  NOT NULL,
  hazard_id     VARCHAR(128)  NOT NULL,
  exposure_type VARCHAR(64)   NOT NULL,
  severity      DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  exposed_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at      DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_exposure_player (player_id),
  INDEX idx_exposure_hazard (hazard_id),
  INDEX idx_exposure_active (ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 130_create_fatigue_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_fatigue_runtime (
  id           VARCHAR(26)   NOT NULL,
  player_id    VARCHAR(128)  NOT NULL,
  fatigue_level DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  rest_debt    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  last_rest_at DATETIME(3)   NULL,
  last_tick_at DATETIME(3)   NULL,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fatigue_player (player_id),
  INDEX idx_fatigue_level (fatigue_level),
  INDEX idx_fatigue_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 131_create_hydration_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_hydration_runtime (
  id              VARCHAR(26)   NOT NULL,
  player_id       VARCHAR(128)  NOT NULL,
  hydration_level DECIMAL(5,2)  NOT NULL DEFAULT 100.00,
  depletion_rate  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  last_drink_at   DATETIME(3)   NULL,
  last_tick_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hydration_player (player_id),
  INDEX idx_hydration_level (hydration_level),
  INDEX idx_hydration_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 132_create_environmental_hazards.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_environmental_hazards (
  id              VARCHAR(26)   NOT NULL,
  hazard_id       VARCHAR(128)  NOT NULL,
  hazard_type     VARCHAR(64)   NOT NULL,
  zone_id         VARCHAR(128)  NOT NULL,
  severity        DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id VARCHAR(128)  NULL,
  started_at      DATETIME(3)   NULL,
  ended_at        DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hazard_id (hazard_id),
  INDEX idx_hazard_zone (zone_id),
  INDEX idx_hazard_active (is_active),
  INDEX idx_hazard_type (hazard_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 133_create_crafting_recipes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_crafting_recipes (
  id                   VARCHAR(26)   NOT NULL,
  recipe_id            VARCHAR(128)  NOT NULL,
  recipe_name          VARCHAR(256)  NOT NULL,
  output_item_id       VARCHAR(128)  NOT NULL,
  output_quantity      INT           NOT NULL DEFAULT 1,
  recipe_type          VARCHAR(32)   NOT NULL DEFAULT 'basic',
  required_station     VARCHAR(128)  NULL,
  crafting_time_seconds INT          NOT NULL DEFAULT 60,
  is_discoverable      TINYINT(1)    NOT NULL DEFAULT 1,
  is_active            TINYINT(1)    NOT NULL DEFAULT 1,
  created_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_recipe_id (recipe_id),
  INDEX idx_recipe_type (recipe_type),
  INDEX idx_recipe_active (is_active),
  INDEX idx_recipe_station (required_station)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 134_create_crafting_blueprints.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_crafting_blueprints (
  id           VARCHAR(26)   NOT NULL,
  blueprint_id VARCHAR(128)  NOT NULL,
  principal_id VARCHAR(128)  NOT NULL,
  recipe_id    VARCHAR(128)  NOT NULL,
  source       VARCHAR(128)  NOT NULL DEFAULT 'unknown',
  acquired_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_blueprint_id (blueprint_id),
  UNIQUE KEY uq_blueprint_principal_recipe (principal_id, recipe_id),
  INDEX idx_blueprint_principal (principal_id),
  INDEX idx_blueprint_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 135_create_manufacturing_queues.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_manufacturing_queues (
  id                     VARCHAR(26)   NOT NULL,
  queue_id               VARCHAR(128)  NOT NULL,
  station_id             VARCHAR(128)  NOT NULL,
  station_type           VARCHAR(64)   NOT NULL DEFAULT 'workbench',
  status                 VARCHAR(32)   NOT NULL DEFAULT 'idle',
  current_job_id         VARCHAR(128)  NULL,
  operator_principal_id  VARCHAR(128)  NULL,
  created_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_queue_id (queue_id),
  UNIQUE KEY uq_queue_station (station_id),
  INDEX idx_queue_status (status),
  INDEX idx_queue_station_type (station_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 136_create_production_jobs.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_production_jobs (
  id                        VARCHAR(26)   NOT NULL,
  job_id                    VARCHAR(128)  NOT NULL,
  queue_id                  VARCHAR(128)  NOT NULL,
  recipe_id                 VARCHAR(128)  NOT NULL,
  initiated_by_principal_id VARCHAR(128)  NOT NULL,
  status                    VARCHAR(32)   NOT NULL DEFAULT 'pending',
  quantity_ordered          INT           NOT NULL DEFAULT 1,
  quantity_produced         INT           NOT NULL DEFAULT 0,
  job_nonce                 VARCHAR(128)  NOT NULL,
  started_at                DATETIME(3)   NULL,
  completed_at              DATETIME(3)   NULL,
  failed_reason             TEXT          NULL,
  created_at                DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_job_id (job_id),
  UNIQUE KEY uq_job_nonce (job_nonce),
  INDEX idx_job_queue (queue_id),
  INDEX idx_job_status (status),
  INDEX idx_job_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 137_create_crafting_resource_consumption.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_crafting_resource_consumption (
  id            VARCHAR(26)   NOT NULL,
  consumer_id   VARCHAR(128)  NOT NULL,
  resource_type VARCHAR(64)   NOT NULL,
  amount        DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
  consumed_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  period_label  VARCHAR(64)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_craft_res_consumer (consumer_id),
  INDEX idx_craft_res_type (resource_type),
  INDEX idx_craft_res_period (period_label),
  INDEX idx_craft_res_consumed (consumed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 138_create_crafting_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_crafting_audit (
  id                       VARCHAR(26)   NOT NULL,
  audit_id                 VARCHAR(128)  NOT NULL,
  job_id                   VARCHAR(128)  NOT NULL,
  action                   VARCHAR(64)   NOT NULL,
  performed_by_principal_id VARCHAR(128) NULL,
  note                     TEXT          NULL,
  created_at               DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crafting_audit_id (audit_id),
  INDEX idx_crafting_audit_job (job_id),
  INDEX idx_crafting_audit_action (action),
  INDEX idx_crafting_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 139_create_shipments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_shipments (
  id                   VARCHAR(26)    NOT NULL,
  shipment_id          VARCHAR(128)   NOT NULL,
  shipment_nonce       VARCHAR(128)   NOT NULL,
  origin_id            VARCHAR(128)   NOT NULL,
  destination_id       VARCHAR(128)   NOT NULL,
  carrier_principal_id VARCHAR(128)   NULL,
  status               VARCHAR(32)    NOT NULL DEFAULT 'pending',
  cargo_manifest       TEXT           NOT NULL DEFAULT '[]',
  departed_at          DATETIME(3)    NULL,
  arrived_at           DATETIME(3)    NULL,
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_shipment_id (shipment_id),
  UNIQUE KEY uq_shipment_nonce (shipment_nonce),
  INDEX idx_shipment_status (status),
  INDEX idx_shipment_carrier (carrier_principal_id),
  INDEX idx_shipment_origin (origin_id),
  INDEX idx_shipment_destination (destination_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 140_create_cargo_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_cargo_runtime (
  id           VARCHAR(26)    NOT NULL,
  cargo_id     VARCHAR(128)   NOT NULL,
  shipment_id  VARCHAR(128)   NOT NULL,
  item_id      VARCHAR(128)   NOT NULL,
  quantity     INT            NOT NULL DEFAULT 1,
  weight       DECIMAL(10,3)  NOT NULL DEFAULT 0.000,
  is_contraband TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cargo_id (cargo_id),
  INDEX idx_cargo_shipment (shipment_id),
  INDEX idx_cargo_item (item_id),
  INDEX idx_cargo_contraband (is_contraband)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 141_create_supply_routes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_supply_routes (
  id                          VARCHAR(26)   NOT NULL,
  route_id                    VARCHAR(128)  NOT NULL,
  route_name                  VARCHAR(256)  NOT NULL,
  origin_node_id              VARCHAR(128)  NOT NULL,
  destination_node_id         VARCHAR(128)  NOT NULL,
  route_type                  VARCHAR(32)   NOT NULL DEFAULT 'ground',
  distance_km                 DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  estimated_duration_minutes  INT           NOT NULL DEFAULT 60,
  is_active                   TINYINT(1)    NOT NULL DEFAULT 1,
  created_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_route_id (route_id),
  INDEX idx_route_type (route_type),
  INDEX idx_route_active (is_active),
  INDEX idx_route_origin (origin_node_id),
  INDEX idx_route_destination (destination_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 142_create_logistics_fleets.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_logistics_fleets (
  id                 VARCHAR(26)   NOT NULL,
  fleet_id           VARCHAR(128)  NOT NULL,
  fleet_name         VARCHAR(256)  NOT NULL,
  owner_principal_id VARCHAR(128)  NOT NULL,
  vehicle_ids        TEXT          NOT NULL DEFAULT '[]',
  status             VARCHAR(32)   NOT NULL DEFAULT 'available',
  assigned_route_id  VARCHAR(128)  NULL,
  created_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fleet_id (fleet_id),
  INDEX idx_fleet_owner (owner_principal_id),
  INDEX idx_fleet_status (status),
  INDEX idx_fleet_route (assigned_route_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 143_create_supply_chain_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_supply_chain_runtime (
  id           VARCHAR(26)   NOT NULL,
  chain_id     VARCHAR(128)  NOT NULL,
  chain_name   VARCHAR(256)  NOT NULL,
  nodes        TEXT          NOT NULL DEFAULT '[]',
  edges        TEXT          NOT NULL DEFAULT '[]',
  status       VARCHAR(32)   NOT NULL DEFAULT 'active',
  last_tick_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chain_id (chain_id),
  INDEX idx_chain_status (status),
  INDEX idx_chain_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 144_create_delivery_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_delivery_audit (
  id                        VARCHAR(26)   NOT NULL,
  audit_id                  VARCHAR(128)  NOT NULL,
  shipment_id               VARCHAR(128)  NOT NULL,
  action                    VARCHAR(64)   NOT NULL,
  performed_by_principal_id VARCHAR(128)  NULL,
  note                      TEXT          NULL,
  created_at                DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_audit_id (audit_id),
  INDEX idx_delivery_audit_shipment (shipment_id),
  INDEX idx_delivery_audit_action (action),
  INDEX idx_delivery_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 145_create_vessels.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_vessels (
  id                    VARCHAR(26)    NOT NULL,
  vessel_id             VARCHAR(128)   NOT NULL,
  vessel_name           VARCHAR(255)   NOT NULL,
  vessel_type           VARCHAR(64)    NOT NULL,
  owned_by_principal_id VARCHAR(128)   NULL,
  status                VARCHAR(32)    NOT NULL DEFAULT 'docked',
  position_x            DECIMAL(12,4)  NULL,
  position_y            DECIMAL(12,4)  NULL,
  position_z            DECIMAL(12,4)  NULL,
  heading               DECIMAL(8,4)   NULL,
  speed_knots           DECIMAL(8,3)   NULL,
  current_zone_id       VARCHAR(128)   NULL,
  last_tick_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vessel_id (vessel_id),
  INDEX idx_vessel_status (status),
  INDEX idx_vessel_owner (owned_by_principal_id),
  INDEX idx_vessel_zone (current_zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 146_create_aircraft.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_aircraft (
  id                    VARCHAR(26)    NOT NULL,
  aircraft_id           VARCHAR(128)   NOT NULL,
  aircraft_name         VARCHAR(255)   NOT NULL,
  aircraft_type         VARCHAR(64)    NOT NULL,
  owned_by_principal_id VARCHAR(128)   NULL,
  status                VARCHAR(32)    NOT NULL DEFAULT 'on_ground',
  position_x            DECIMAL(12,4)  NULL,
  position_y            DECIMAL(12,4)  NULL,
  position_z            DECIMAL(12,4)  NULL,
  heading               DECIMAL(8,4)   NULL,
  altitude_m            DECIMAL(10,2)  NULL,
  speed_kmh             DECIMAL(10,3)  NULL,
  current_zone_id       VARCHAR(128)   NULL,
  last_tick_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_aircraft_id (aircraft_id),
  INDEX idx_aircraft_status (status),
  INDEX idx_aircraft_owner (owned_by_principal_id),
  INDEX idx_aircraft_zone (current_zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 147_create_flight_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_flight_runtime (
  id                  VARCHAR(26)    NOT NULL,
  flight_id           VARCHAR(128)   NOT NULL,
  flight_nonce        VARCHAR(128)   NOT NULL,
  aircraft_id         VARCHAR(128)   NOT NULL,
  origin_zone_id      VARCHAR(128)   NOT NULL,
  destination_zone_id VARCHAR(128)   NOT NULL,
  status              VARCHAR(32)    NOT NULL DEFAULT 'pending',
  departed_at         DATETIME(3)    NULL,
  landed_at           DATETIME(3)    NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_flight_id (flight_id),
  UNIQUE KEY uq_flight_nonce (flight_nonce),
  INDEX idx_flight_status (status),
  INDEX idx_flight_aircraft (aircraft_id),
  INDEX idx_flight_origin (origin_zone_id),
  INDEX idx_flight_destination (destination_zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 148_create_airspace_zones.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_airspace_zones (
  id               VARCHAR(26)    NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  zone_name        VARCHAR(255)   NOT NULL,
  zone_type        VARCHAR(64)    NOT NULL,
  min_altitude_m   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  max_altitude_m   DECIMAL(10,2)  NOT NULL DEFAULT 10000.00,
  status           VARCHAR(32)    NOT NULL DEFAULT 'open',
  owner_server_id  VARCHAR(128)   NULL,
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_zone_id (zone_id),
  INDEX idx_airspace_status (status),
  INDEX idx_airspace_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 149_create_docking_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_docking_runtime (
  id             VARCHAR(26)    NOT NULL,
  docking_id     VARCHAR(128)   NOT NULL,
  docking_nonce  VARCHAR(128)   NOT NULL,
  vessel_id      VARCHAR(128)   NOT NULL,
  dock_zone_id   VARCHAR(128)   NOT NULL,
  slot_id        VARCHAR(128)   NULL,
  status         VARCHAR(32)    NOT NULL DEFAULT 'occupied',
  docked_at      DATETIME(3)    NULL,
  undocked_at    DATETIME(3)    NULL,
  created_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_docking_id (docking_id),
  UNIQUE KEY uq_docking_nonce (docking_nonce),
  INDEX idx_docking_vessel (vessel_id),
  INDEX idx_docking_zone (dock_zone_id),
  INDEX idx_docking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 150_create_transport_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_transport_audit (
  id           VARCHAR(26)    NOT NULL,
  subject_id   VARCHAR(128)   NOT NULL,
  subject_type VARCHAR(64)    NOT NULL,
  action       VARCHAR(128)   NOT NULL,
  actor_id     VARCHAR(128)   NULL,
  detail       TEXT           NULL,
  occurred_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_transport_audit_subject (subject_id),
  INDEX idx_transport_audit_type (subject_type),
  INDEX idx_transport_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 151_create_radio_channels.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_radio_channels (
  id                  VARCHAR(26)    NOT NULL,
  channel_id          VARCHAR(128)   NOT NULL,
  channel_name        VARCHAR(255)   NOT NULL,
  channel_type        VARCHAR(64)    NOT NULL DEFAULT 'open',
  frequency           DECIMAL(8,3)   NOT NULL,
  status              VARCHAR(32)    NOT NULL DEFAULT 'active',
  owner_principal_id  VARCHAR(128)   NULL,
  is_encrypted        TINYINT(1)     NOT NULL DEFAULT 0,
  max_members         INT            NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_channel_id (channel_id),
  INDEX idx_channel_type (channel_type),
  INDEX idx_channel_status (status),
  INDEX idx_channel_owner (owner_principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 152_create_radio_memberships.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_radio_memberships (
  id           VARCHAR(26)    NOT NULL,
  channel_id   VARCHAR(128)   NOT NULL,
  principal_id VARCHAR(128)   NOT NULL,
  role         VARCHAR(32)    NOT NULL DEFAULT 'listener',
  joined_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_membership (channel_id, principal_id),
  INDEX idx_membership_channel (channel_id),
  INDEX idx_membership_principal (principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 153_create_signal_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_signal_runtime (
  id               VARCHAR(26)    NOT NULL,
  signal_id        VARCHAR(128)   NOT NULL,
  channel_id       VARCHAR(128)   NULL,
  signal_type      VARCHAR(64)    NOT NULL,
  strength         DECIMAL(5,2)   NOT NULL DEFAULT 100.00,
  status           VARCHAR(32)    NOT NULL DEFAULT 'active',
  origin_zone_id   VARCHAR(128)   NULL,
  owner_server_id  VARCHAR(128)   NOT NULL,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_signal_id (signal_id),
  INDEX idx_signal_status (status),
  INDEX idx_signal_channel (channel_id),
  INDEX idx_signal_zone (origin_zone_id),
  INDEX idx_signal_last_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 154_create_emergency_broadcasts.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_emergency_broadcasts (
  id                       VARCHAR(26)    NOT NULL,
  broadcast_id             VARCHAR(128)   NOT NULL,
  broadcast_nonce          VARCHAR(128)   NOT NULL,
  initiated_by_principal_id VARCHAR(128)  NOT NULL,
  message                  TEXT           NOT NULL,
  severity                 VARCHAR(32)    NOT NULL DEFAULT 'info',
  status                   VARCHAR(32)    NOT NULL DEFAULT 'active',
  target_zone_id           VARCHAR(128)   NULL,
  expires_at               DATETIME(3)    NULL,
  created_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_broadcast_id (broadcast_id),
  UNIQUE KEY uq_broadcast_nonce (broadcast_nonce),
  INDEX idx_broadcast_status (status),
  INDEX idx_broadcast_severity (severity),
  INDEX idx_broadcast_zone (target_zone_id),
  INDEX idx_broadcast_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 155_create_encrypted_channels.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_encrypted_channels (
  id                   VARCHAR(26)    NOT NULL,
  channel_id           VARCHAR(128)   NOT NULL,
  encryption_key_hash  VARCHAR(255)   NOT NULL,
  key_rotated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_enc_channel_id (channel_id),
  INDEX idx_enc_key_rotated (key_rotated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 156_create_communication_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_communication_audit (
  id           VARCHAR(26)    NOT NULL,
  subject_id   VARCHAR(128)   NOT NULL,
  subject_type VARCHAR(64)    NOT NULL,
  action       VARCHAR(128)   NOT NULL,
  actor_id     VARCHAR(128)   NULL,
  detail       TEXT           NULL,
  occurred_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_comm_audit_subject (subject_id),
  INDEX idx_comm_audit_type (subject_type),
  INDEX idx_comm_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 157_create_disaster_events.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_disaster_events (
  id                       VARCHAR(26)    NOT NULL,
  disaster_id              VARCHAR(128)   NOT NULL,
  disaster_nonce           VARCHAR(128)   NOT NULL,
  disaster_type            VARCHAR(64)    NOT NULL,
  disaster_name            VARCHAR(255)   NOT NULL,
  severity                 DECIMAL(5,2)   NOT NULL DEFAULT 50.00,
  status                   VARCHAR(32)    NOT NULL DEFAULT 'active',
  affected_zone_ids        TEXT           NOT NULL DEFAULT '[]',
  initiated_by_principal_id VARCHAR(128)  NULL,
  owner_server_id          VARCHAR(128)   NULL,
  contained_at             DATETIME(3)    NULL,
  resolved_at              DATETIME(3)    NULL,
  created_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_disaster_id (disaster_id),
  UNIQUE KEY uq_disaster_nonce (disaster_nonce),
  INDEX idx_disaster_status (status),
  INDEX idx_disaster_type (disaster_type),
  INDEX idx_disaster_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 158_create_hazard_zones.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_hazard_zones (
  id                  VARCHAR(26)    NOT NULL,
  zone_id             VARCHAR(128)   NOT NULL,
  disaster_id         VARCHAR(128)   NULL,
  hazard_type         VARCHAR(64)    NOT NULL,
  severity            DECIMAL(5,2)   NOT NULL DEFAULT 50.00,
  status              VARCHAR(32)    NOT NULL DEFAULT 'active',
  propagation_radius  DECIMAL(10,2)  NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hazard_zone_id (zone_id),
  INDEX idx_hazard_disaster (disaster_id),
  INDEX idx_hazard_type (hazard_type),
  INDEX idx_hazard_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 159_create_evacuation_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_evacuation_runtime (
  id               VARCHAR(26)    NOT NULL,
  evacuation_id    VARCHAR(128)   NOT NULL,
  evacuation_nonce VARCHAR(128)   NOT NULL,
  disaster_id      VARCHAR(128)   NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  evacuation_type  VARCHAR(64)    NOT NULL,
  evacuated_count  INT            NOT NULL DEFAULT 0,
  target_count     INT            NULL,
  status           VARCHAR(32)    NOT NULL DEFAULT 'initiated',
  completed_at     DATETIME(3)    NULL,
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evacuation_id (evacuation_id),
  UNIQUE KEY uq_evacuation_nonce (evacuation_nonce),
  INDEX idx_evacuation_disaster (disaster_id),
  INDEX idx_evacuation_zone (zone_id),
  INDEX idx_evacuation_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 160_create_emergency_response.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_emergency_response (
  id                      VARCHAR(26)    NOT NULL,
  response_id             VARCHAR(128)   NOT NULL,
  disaster_id             VARCHAR(128)   NULL,
  response_type           VARCHAR(64)    NOT NULL,
  responder_principal_id  VARCHAR(128)   NULL,
  status                  VARCHAR(32)    NOT NULL DEFAULT 'dispatched',
  dispatched_at           DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  arrived_at              DATETIME(3)    NULL,
  completed_at            DATETIME(3)    NULL,
  created_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at              DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_response_id (response_id),
  INDEX idx_response_disaster (disaster_id),
  INDEX idx_response_type (response_type),
  INDEX idx_response_status (status),
  INDEX idx_response_responder (responder_principal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 161_create_recovery_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_recovery_runtime (
  id                       VARCHAR(26)    NOT NULL,
  disaster_id              VARCHAR(128)   NOT NULL,
  recovery_phase           VARCHAR(64)    NOT NULL DEFAULT 'initial',
  progress_percent         DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  estimated_completion_at  DATETIME(3)    NULL,
  completed_at             DATETIME(3)    NULL,
  created_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at               DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_recovery_disaster (disaster_id),
  INDEX idx_recovery_phase (recovery_phase),
  INDEX idx_recovery_progress (progress_percent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 162_create_disaster_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_disaster_audit (
  id           VARCHAR(26)    NOT NULL,
  subject_id   VARCHAR(128)   NOT NULL,
  subject_type VARCHAR(64)    NOT NULL,
  action       VARCHAR(128)   NOT NULL,
  actor_id     VARCHAR(128)   NULL,
  detail       TEXT           NULL,
  occurred_at  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_disaster_audit_subject (subject_id),
  INDEX idx_disaster_audit_type (subject_type),
  INDEX idx_disaster_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 163_create_missions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_missions (
  id             VARCHAR(26)   NOT NULL,
  mission_id     VARCHAR(26)   NOT NULL,
  mission_nonce  VARCHAR(128)  NOT NULL,
  mission_type   VARCHAR(64)   NOT NULL,
  mission_name   VARCHAR(255)  NOT NULL,
  status         VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id    VARCHAR(128) NULL,
  owner_principal_id VARCHAR(128) NULL,
  config_data    TEXT          NOT NULL DEFAULT '{}',
  started_at     DATETIME(3)   NULL,
  completed_at   DATETIME(3)   NULL,
  failed_at      DATETIME(3)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_missions_mission_id (mission_id),
  UNIQUE KEY uq_missions_nonce (mission_nonce),
  KEY idx_missions_status (status),
  KEY idx_missions_owner_server (owner_server_id),
  KEY idx_missions_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 164_create_mission_objectives.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_mission_objectives (
  id              VARCHAR(26)   NOT NULL,
  objective_id    VARCHAR(26)   NOT NULL,
  mission_id      VARCHAR(26)   NOT NULL,
  objective_type  VARCHAR(64)   NOT NULL,
  objective_name  VARCHAR(255)  NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  sequence_order  INT           NOT NULL DEFAULT 0,
  completion_data TEXT          NOT NULL DEFAULT '{}',
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_objectives_objective_id (objective_id),
  KEY idx_objectives_mission_id (mission_id),
  KEY idx_objectives_status (status),
  KEY idx_objectives_sequence (mission_id, sequence_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 165_create_mission_assignments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_mission_assignments (
  id             VARCHAR(26)   NOT NULL,
  assignment_id  VARCHAR(26)   NOT NULL,
  mission_id     VARCHAR(26)   NOT NULL,
  assignee_id    VARCHAR(128)  NOT NULL,
  assignee_type  VARCHAR(32)   NOT NULL DEFAULT 'player',
  role           VARCHAR(32)   NOT NULL DEFAULT 'participant',
  assigned_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at    DATETIME(3)   NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignments_id (assignment_id),
  UNIQUE KEY uq_assignments_mission_assignee (mission_id, assignee_id),
  KEY idx_assignments_assignee (assignee_id),
  KEY idx_assignments_mission (mission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 166_create_scenario_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_scenario_runtime (
  id              VARCHAR(26)   NOT NULL,
  scenario_id     VARCHAR(128)  NOT NULL,
  scenario_type   VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'spawning',
  mission_id      VARCHAR(26)   NULL,
  config_data     TEXT          NOT NULL DEFAULT '{}',
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  owner_server_id VARCHAR(128)  NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_scenario_scenario_id (scenario_id),
  KEY idx_scenario_status (status),
  KEY idx_scenario_mission (mission_id),
  KEY idx_scenario_last_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 167_create_dynamic_events.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_dynamic_events (
  id              VARCHAR(26)   NOT NULL,
  event_id        VARCHAR(26)   NOT NULL,
  event_nonce     VARCHAR(128)  NOT NULL,
  event_type      VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  trigger_data    TEXT          NOT NULL DEFAULT '{}',
  zone_id         VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NULL,
  expires_at      DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_dynamic_events_event_id (event_id),
  UNIQUE KEY uq_dynamic_events_nonce (event_nonce),
  KEY idx_dynamic_events_status (status),
  KEY idx_dynamic_events_zone (zone_id),
  KEY idx_dynamic_events_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 168_create_mission_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_mission_audit (
  id           VARCHAR(26)   NOT NULL,
  subject_id   VARCHAR(128)  NOT NULL,
  subject_type VARCHAR(64)   NOT NULL,
  action       VARCHAR(128)  NOT NULL,
  actor_id     VARCHAR(128)  NULL,
  detail       TEXT          NULL,
  occurred_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_mission_audit_subject (subject_id),
  KEY idx_mission_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 169_create_reputation_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_reputation_runtime (
  id               VARCHAR(26)   NOT NULL,
  principal_id     VARCHAR(128)  NOT NULL,
  faction_id       VARCHAR(128)  NOT NULL,
  reputation_score DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tier             VARCHAR(32)   NOT NULL DEFAULT 'neutral',
  last_change_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reputation_principal_faction (principal_id, faction_id),
  KEY idx_reputation_principal (principal_id),
  KEY idx_reputation_faction (faction_id),
  KEY idx_reputation_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 170_create_diplomatic_relations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_diplomatic_relations (
  id              VARCHAR(26)   NOT NULL,
  faction_a_id    VARCHAR(128)  NOT NULL,
  faction_b_id    VARCHAR(128)  NOT NULL,
  relation_status VARCHAR(32)   NOT NULL DEFAULT 'neutral',
  relation_score  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  last_updated_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_diplomatic_factions (faction_a_id, faction_b_id),
  KEY idx_diplomatic_faction_a (faction_a_id),
  KEY idx_diplomatic_faction_b (faction_b_id),
  KEY idx_diplomatic_status (relation_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 171_create_social_standing.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_social_standing (
  id             VARCHAR(26)   NOT NULL,
  principal_id   VARCHAR(128)  NOT NULL,
  standing_score DECIMAL(10,2) NOT NULL DEFAULT 200.00,
  standing_tier  VARCHAR(32)   NOT NULL DEFAULT 'common',
  last_change_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_social_standing_principal (principal_id),
  KEY idx_social_standing_tier (standing_tier),
  KEY idx_social_standing_score (standing_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 172_create_influence_history.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_influence_history (
  id             VARCHAR(26)   NOT NULL,
  principal_id   VARCHAR(128)  NOT NULL,
  faction_id     VARCHAR(128)  NULL,
  change_amount  DECIMAL(10,2) NOT NULL,
  change_reason  VARCHAR(255)  NOT NULL,
  change_type    VARCHAR(32)   NOT NULL,
  actor_id       VARCHAR(128)  NULL,
  created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_influence_principal (principal_id),
  KEY idx_influence_faction (faction_id),
  KEY idx_influence_created (created_at),
  KEY idx_influence_type (change_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 173_create_reputation_decay.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_reputation_decay (
  id              VARCHAR(26)   NOT NULL,
  principal_id    VARCHAR(128)  NOT NULL,
  faction_id      VARCHAR(128)  NULL,
  decay_rate      DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  next_decay_at   DATETIME(3)   NOT NULL,
  last_decayed_at DATETIME(3)   NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_decay_principal_faction (principal_id, faction_id),
  KEY idx_decay_next_decay (next_decay_at),
  KEY idx_decay_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 174_create_relationship_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_relationship_audit (
  id           VARCHAR(26)   NOT NULL,
  subject_id   VARCHAR(128)  NOT NULL,
  subject_type VARCHAR(64)   NOT NULL,
  action       VARCHAR(128)  NOT NULL,
  actor_id     VARCHAR(128)  NULL,
  detail       TEXT          NULL,
  occurred_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_relationship_audit_subject (subject_id),
  KEY idx_relationship_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 175_create_ai_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ai_runtime (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  entity_type     VARCHAR(64)   NOT NULL,
  ai_state        VARCHAR(32)   NOT NULL DEFAULT 'idle',
  behavior_mode   VARCHAR(32)   NOT NULL DEFAULT 'passive',
  owner_server_id VARCHAR(128)  NULL,
  position_data   TEXT          NOT NULL DEFAULT '{}',
  threat_level    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_runtime_entity_id (entity_id),
  KEY idx_ai_runtime_state (ai_state),
  KEY idx_ai_runtime_owner (owner_server_id),
  KEY idx_ai_runtime_last_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 176_create_ai_patrols.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ai_patrols (
  id              VARCHAR(26)   NOT NULL,
  patrol_id       VARCHAR(26)   NOT NULL,
  patrol_nonce    VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  patrol_type     VARCHAR(32)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  route_data      TEXT          NOT NULL DEFAULT '{}',
  owner_server_id VARCHAR(128)  NULL,
  started_at      DATETIME(3)   NULL,
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_patrols_patrol_id (patrol_id),
  UNIQUE KEY uq_ai_patrols_nonce (patrol_nonce),
  KEY idx_ai_patrols_entity (entity_id),
  KEY idx_ai_patrols_status (status),
  KEY idx_ai_patrols_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 177_create_ai_threat_assessment.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ai_threat_assessment (
  id               VARCHAR(26)   NOT NULL,
  assessment_id    VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  threat_source_id VARCHAR(128)  NULL,
  threat_level     VARCHAR(32)   NOT NULL DEFAULT 'low',
  threat_type      VARCHAR(32)   NOT NULL,
  assessment_data  TEXT          NOT NULL DEFAULT '{}',
  expires_at       DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_threat_assessment_id (assessment_id),
  KEY idx_ai_threat_entity (entity_id),
  KEY idx_ai_threat_level (threat_level),
  KEY idx_ai_threat_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 178_create_ai_reinforcements.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ai_reinforcements (
  id                    VARCHAR(26)   NOT NULL,
  reinforcement_id      VARCHAR(26)   NOT NULL,
  reinforcement_nonce   VARCHAR(128)  NOT NULL,
  requesting_entity_id  VARCHAR(128)  NULL,
  reinforcement_type    VARCHAR(64)   NOT NULL,
  status                VARCHAR(32)   NOT NULL DEFAULT 'requested',
  quantity              INT           NOT NULL DEFAULT 1,
  owner_server_id       VARCHAR(128)  NULL,
  dispatched_at         DATETIME(3)   NULL,
  arrived_at            DATETIME(3)   NULL,
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_reinforcements_id (reinforcement_id),
  UNIQUE KEY uq_ai_reinforcements_nonce (reinforcement_nonce),
  KEY idx_ai_reinforcements_status (status),
  KEY idx_ai_reinforcements_entity (requesting_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 179_create_ai_response_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ai_response_runtime (
  id              VARCHAR(26)   NOT NULL,
  response_id     VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  response_type   VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'activating',
  target_id       VARCHAR(128)  NULL,
  tactical_data   TEXT          NOT NULL DEFAULT '{}',
  owner_server_id VARCHAR(128)  NULL,
  activated_at    DATETIME(3)   NULL,
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ai_response_id (response_id),
  KEY idx_ai_response_entity (entity_id),
  KEY idx_ai_response_status (status),
  KEY idx_ai_response_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 180_create_ai_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ai_audit (
  id           VARCHAR(26)   NOT NULL,
  subject_id   VARCHAR(128)  NOT NULL,
  subject_type VARCHAR(64)   NOT NULL,
  action       VARCHAR(128)  NOT NULL,
  actor_id     VARCHAR(128)  NULL,
  detail       TEXT          NULL,
  occurred_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ai_audit_subject (subject_id),
  KEY idx_ai_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 181_create_spatial_nodes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_spatial_nodes (
  id              VARCHAR(26)   NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  node_type       VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  region_id       VARCHAR(128)  NULL,
  position_data   TEXT          NULL,
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_spatial_node_id (node_id),
  KEY idx_spatial_node_server (owner_server_id),
  KEY idx_spatial_node_region (region_id),
  KEY idx_spatial_node_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 182_create_runtime_snapshots.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_snapshots (
  id              VARCHAR(26)   NOT NULL,
  snapshot_id     VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  snapshot_type   VARCHAR(32)   NOT NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  snapshot_data   TEXT          NULL,
  sequence_number BIGINT        NOT NULL DEFAULT 0,
  is_replayed     TINYINT(1)    NOT NULL DEFAULT 0,
  replayed_at     DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_snapshot_id (snapshot_id),
  KEY idx_snapshot_entity (entity_id),
  KEY idx_snapshot_entity_seq (entity_id, sequence_number),
  KEY idx_snapshot_replayed (is_replayed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 183_create_spatial_ownership.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_spatial_ownership (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  entity_type     VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  region_id       VARCHAR(128)  NULL,
  last_claimed_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  transferred_at  DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_spatial_ownership_entity (entity_id),
  KEY idx_spatial_ownership_server (owner_server_id),
  KEY idx_spatial_ownership_region (region_id),
  KEY idx_spatial_ownership_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 184_create_interest_regions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_interest_regions (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  region_type     VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  bounds_data     TEXT          NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_interest_region_id (region_id),
  KEY idx_interest_region_server (owner_server_id),
  KEY idx_interest_region_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 185_create_streaming_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_streaming_runtime (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  streaming_state VARCHAR(32)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  last_stream_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_streaming_runtime_entity (entity_id),
  KEY idx_streaming_runtime_server (owner_server_id),
  KEY idx_streaming_runtime_state (streaming_state),
  KEY idx_streaming_runtime_stream (last_stream_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 186_create_replication_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_replication_audit (
  id          VARCHAR(26)   NOT NULL,
  subject_id  VARCHAR(128)  NOT NULL,
  action      VARCHAR(128)  NOT NULL,
  server_id   VARCHAR(128)  NULL,
  detail      TEXT          NULL,
  occurred_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_replication_audit_subject (subject_id),
  KEY idx_replication_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 187_create_runtime_migrations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_migrations (
  id              VARCHAR(26)   NOT NULL,
  migration_id    VARCHAR(26)   NOT NULL,
  migration_nonce VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  from_server_id  VARCHAR(128)  NOT NULL,
  to_server_id    VARCHAR(128)  NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  migration_data  TEXT          NULL,
  failure_reason  TEXT          NULL,
  completed_at    DATETIME(3)   NULL,
  failed_at       DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_migration_id (migration_id),
  UNIQUE KEY uk_migration_nonce (migration_nonce),
  KEY idx_runtime_migration_entity (entity_id),
  KEY idx_runtime_migration_status (status),
  KEY idx_runtime_migration_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 188_create_node_transfers.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_node_transfers (
  id              VARCHAR(26)   NOT NULL,
  transfer_id     VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  from_server_id  VARCHAR(128)  NOT NULL,
  to_server_id    VARCHAR(128)  NOT NULL,
  transfer_status VARCHAR(32)   NOT NULL DEFAULT 'initiated',
  transfer_data   TEXT          NULL,
  completed_at    DATETIME(3)   NULL,
  failed_at       DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_transfer_id (transfer_id),
  KEY idx_node_transfer_entity (entity_id),
  KEY idx_node_transfer_status (transfer_status),
  KEY idx_node_transfer_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 189_create_reconciliation_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_reconciliation_runtime (
  id                  VARCHAR(26)   NOT NULL,
  reconciliation_id   VARCHAR(26)   NOT NULL,
  region_id           VARCHAR(128)  NULL,
  server_id           VARCHAR(128)  NULL,
  reconciliation_type VARCHAR(64)   NOT NULL,
  status              VARCHAR(32)   NOT NULL DEFAULT 'running',
  issues_found        INT           NOT NULL DEFAULT 0,
  issues_resolved     INT           NOT NULL DEFAULT 0,
  last_run_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_reconciliation_id (reconciliation_id),
  KEY idx_reconciliation_status (status),
  KEY idx_reconciliation_region (region_id),
  KEY idx_reconciliation_server (server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 190_create_snapshot_replay.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_snapshot_replay (
  id            VARCHAR(26)   NOT NULL,
  replay_id     VARCHAR(26)   NOT NULL,
  entity_id     VARCHAR(128)  NOT NULL,
  snapshot_id   VARCHAR(26)   NOT NULL,
  replay_status VARCHAR(32)   NOT NULL DEFAULT 'pending',
  replay_data   TEXT          NULL,
  completed_at  DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_replay_id (replay_id),
  KEY idx_snapshot_replay_entity (entity_id),
  KEY idx_snapshot_replay_snapshot (snapshot_id),
  KEY idx_snapshot_replay_status (replay_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 191_create_runtime_recovery.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_recovery (
  id               VARCHAR(26)   NOT NULL,
  recovery_id      VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  recovery_type    VARCHAR(32)   NOT NULL,
  target_server_id VARCHAR(128)  NULL,
  recovery_status  VARCHAR(32)   NOT NULL DEFAULT 'pending',
  completed_at     DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_recovery_id (recovery_id),
  KEY idx_runtime_recovery_entity (entity_id),
  KEY idx_runtime_recovery_status (recovery_status),
  KEY idx_runtime_recovery_type (recovery_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 192_create_runtime_consistency_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_consistency_audit (
  id          VARCHAR(26)   NOT NULL,
  subject_id  VARCHAR(128)  NOT NULL,
  action      VARCHAR(128)  NOT NULL,
  server_id   VARCHAR(128)  NULL,
  detail      TEXT          NULL,
  occurred_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_consistency_audit_subject (subject_id),
  KEY idx_consistency_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 193_create_world_regions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_world_regions (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  region_type     VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  bounds_data     TEXT          NOT NULL DEFAULT '{}',
  capacity_limit  INT           NULL,
  current_load    INT           NOT NULL DEFAULT 0,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  transferred_at  DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_world_region_id (region_id),
  KEY idx_world_region_server (owner_server_id),
  KEY idx_world_region_active (is_active),
  KEY idx_world_region_type (region_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 194_create_runtime_allocations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_allocations (
  id              VARCHAR(26)   NOT NULL,
  allocation_id   VARCHAR(26)   NOT NULL,
  shard_id        VARCHAR(128)  NOT NULL,
  server_id       VARCHAR(128)  NOT NULL,
  allocation_type VARCHAR(32)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  allocation_data TEXT          NOT NULL DEFAULT '{}',
  deallocated_at  DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_id (allocation_id),
  KEY idx_allocation_shard (shard_id),
  KEY idx_allocation_server (server_id),
  KEY idx_allocation_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 195_create_shard_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_shard_runtime (
  id              VARCHAR(26)   NOT NULL,
  shard_id        VARCHAR(128)  NOT NULL,
  shard_type      VARCHAR(32)   NOT NULL,
  region_id       VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  capacity_limit  INT           NULL,
  current_load    INT           NOT NULL DEFAULT 0,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  transferred_at  DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_shard_id (shard_id),
  KEY idx_shard_runtime_server (owner_server_id),
  KEY idx_shard_runtime_region (region_id),
  KEY idx_shard_runtime_active (is_active),
  KEY idx_shard_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 196_create_regional_simulation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_regional_simulation (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  simulation_type VARCHAR(32)   NOT NULL,
  owner_server_id VARCHAR(128)  NULL,
  simulation_data TEXT          NOT NULL DEFAULT '{}',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  last_tick_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_regional_simulation_region (region_id),
  KEY idx_regional_simulation_server (owner_server_id),
  KEY idx_regional_simulation_active (is_active),
  KEY idx_regional_simulation_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 197_create_world_balancing.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_world_balancing (
  id              VARCHAR(26)   NOT NULL,
  balancing_id    VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NULL,
  trigger_type    VARCHAR(32)   NOT NULL,
  shards_before   INT           NOT NULL DEFAULT 0,
  shards_after    INT           NOT NULL DEFAULT 0,
  load_before     INT           NOT NULL DEFAULT 0,
  load_after      INT           NOT NULL DEFAULT 0,
  balancing_data  TEXT          NOT NULL DEFAULT '{}',
  completed_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_balancing_id (balancing_id),
  KEY idx_world_balancing_region (region_id),
  KEY idx_world_balancing_completed (completed_at),
  KEY idx_world_balancing_trigger (trigger_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 198_create_world_orchestration_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_world_orchestration_audit (
  id          VARCHAR(26)   NOT NULL,
  subject_id  VARCHAR(128)  NOT NULL,
  action      VARCHAR(128)  NOT NULL,
  server_id   VARCHAR(128)  NULL,
  detail      TEXT          NULL,
  occurred_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_world_orch_audit_subject (subject_id),
  KEY idx_world_orch_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 199_create_combat_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_combat_runtime (
  id              VARCHAR(26)   NOT NULL,
  session_id      VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  target_id       VARCHAR(128)  NULL,
  combat_type     VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  region_id       VARCHAR(128)  NULL,
  session_nonce   VARCHAR(128)  NOT NULL,
  combat_data     TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at        DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_combat_session_id (session_id),
  UNIQUE KEY uk_combat_session_nonce (session_nonce),
  KEY idx_combat_entity (entity_id),
  KEY idx_combat_status (status),
  KEY idx_combat_server (owner_server_id),
  KEY idx_combat_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 200_create_ballistics_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ballistics_runtime (
  id                VARCHAR(26)   NOT NULL,
  session_id        VARCHAR(128)  NOT NULL,
  entity_id         VARCHAR(128)  NOT NULL,
  ballistic_type    VARCHAR(64)   NOT NULL,
  trajectory_data   TEXT          NOT NULL DEFAULT '{}',
  impact_data       TEXT          NOT NULL DEFAULT '{}',
  velocity          FLOAT         NOT NULL DEFAULT 0,
  penetration_depth FLOAT         NOT NULL DEFAULT 0,
  owner_server_id   VARCHAR(128)  NOT NULL,
  is_resolved       TINYINT(1)    NOT NULL DEFAULT 0,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ballistics_session (session_id),
  KEY idx_ballistics_entity (entity_id),
  KEY idx_ballistics_resolved (is_resolved),
  KEY idx_ballistics_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 201_create_tactical_damage.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_tactical_damage (
  id                VARCHAR(26)   NOT NULL,
  session_id        VARCHAR(128)  NOT NULL,
  entity_id         VARCHAR(128)  NOT NULL,
  attacker_id       VARCHAR(128)  NULL,
  damage_type       VARCHAR(64)   NOT NULL,
  damage_amount     FLOAT         NOT NULL DEFAULT 0,
  armor_penetration FLOAT         NOT NULL DEFAULT 0,
  body_zone         VARCHAR(64)   NOT NULL DEFAULT 'torso',
  is_processed      TINYINT(1)    NOT NULL DEFAULT 0,
  damage_data       TEXT          NOT NULL DEFAULT '{}',
  owner_server_id   VARCHAR(128)  NOT NULL,
  processed_at      DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_damage_session (session_id),
  KEY idx_damage_entity (entity_id),
  KEY idx_damage_processed (is_processed),
  KEY idx_damage_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 202_create_suppression_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_suppression_runtime (
  id                VARCHAR(26)   NOT NULL,
  entity_id         VARCHAR(128)  NOT NULL,
  suppressor_id     VARCHAR(128)  NULL,
  suppression_type  VARCHAR(64)   NOT NULL,
  suppression_level INT           NOT NULL DEFAULT 0,
  owner_server_id   VARCHAR(128)  NOT NULL,
  region_id         VARCHAR(128)  NULL,
  is_active         TINYINT(1)    NOT NULL DEFAULT 1,
  expires_at        DATETIME(3)   NULL,
  last_tick_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_suppression_entity (entity_id),
  KEY idx_suppression_active (is_active),
  KEY idx_suppression_server (owner_server_id),
  KEY idx_suppression_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 203_create_armor_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_armor_runtime (
  id                    VARCHAR(26)   NOT NULL,
  entity_id             VARCHAR(128)  NOT NULL,
  armor_type            VARCHAR(64)   NOT NULL,
  protection_level      INT           NOT NULL DEFAULT 0,
  penetration_threshold FLOAT         NOT NULL DEFAULT 0,
  current_integrity     FLOAT         NOT NULL DEFAULT 100,
  owner_server_id       VARCHAR(128)  NOT NULL,
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  armor_data            TEXT          NOT NULL DEFAULT '{}',
  created_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_armor_entity (entity_id),
  KEY idx_armor_active (is_active),
  KEY idx_armor_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 204_create_combat_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_combat_audit (
  id          VARCHAR(26)   NOT NULL,
  session_id  VARCHAR(128)  NULL,
  event_type  VARCHAR(128)  NOT NULL,
  entity_id   VARCHAR(128)  NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_combat_audit_session (session_id),
  KEY idx_combat_audit_entity (entity_id),
  KEY idx_combat_audit_event (event_type),
  KEY idx_combat_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 205_create_campaign_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_campaign_runtime (
  id              VARCHAR(26)   NOT NULL,
  campaign_id     VARCHAR(128)  NOT NULL,
  campaign_type   VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  region_id       VARCHAR(128)  NULL,
  campaign_nonce  VARCHAR(128)  NOT NULL,
  campaign_data   TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_campaign_id (campaign_id),
  UNIQUE KEY uk_campaign_nonce (campaign_nonce),
  KEY idx_campaign_status (status),
  KEY idx_campaign_server (owner_server_id),
  KEY idx_campaign_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 206_create_world_events.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_world_events (
  id                VARCHAR(26)   NOT NULL,
  event_id          VARCHAR(128)  NOT NULL,
  event_type        VARCHAR(64)   NOT NULL,
  status            VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id   VARCHAR(128)  NOT NULL,
  region_id         VARCHAR(128)  NULL,
  trigger_condition VARCHAR(256)  NOT NULL DEFAULT '',
  event_data        TEXT          NOT NULL DEFAULT '{}',
  started_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at        DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_world_event_id (event_id),
  KEY idx_world_event_status (status),
  KEY idx_world_event_server (owner_server_id),
  KEY idx_world_event_expires (expires_at),
  KEY idx_world_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 207_create_story_progression.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_story_progression (
  id               VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  campaign_id      VARCHAR(128)  NULL,
  progression_type VARCHAR(64)   NOT NULL,
  stage_key        VARCHAR(256)  NOT NULL,
  progression_data TEXT          NOT NULL DEFAULT '{}',
  owner_server_id  VARCHAR(128)  NOT NULL,
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_story_entity (entity_id),
  KEY idx_story_campaign (campaign_id),
  KEY idx_story_active (is_active),
  KEY idx_story_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 208_create_narrative_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_narrative_runtime (
  id              VARCHAR(26)   NOT NULL,
  session_id      VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  campaign_id     VARCHAR(128)  NULL,
  narrative_type  VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  narrative_data  TEXT          NOT NULL DEFAULT '{}',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_narrative_session_id (session_id),
  KEY idx_narrative_entity (entity_id),
  KEY idx_narrative_status (status),
  KEY idx_narrative_server (owner_server_id),
  KEY idx_narrative_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 209_create_dynamic_story_state.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_dynamic_story_state (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  branch_key      VARCHAR(256)  NOT NULL,
  state_type      VARCHAR(64)   NOT NULL,
  story_data      TEXT          NOT NULL DEFAULT '{}',
  owner_server_id VARCHAR(128)  NOT NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_story_state_entity (entity_id),
  KEY idx_story_state_branch (branch_key(128)),
  KEY idx_story_state_active (is_active),
  KEY idx_story_state_server (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 210_create_narrative_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_narrative_audit (
  id          VARCHAR(26)   NOT NULL,
  session_id  VARCHAR(128)  NULL,
  event_type  VARCHAR(128)  NOT NULL,
  entity_id   VARCHAR(128)  NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_narrative_audit_session (session_id),
  KEY idx_narrative_audit_entity (entity_id),
  KEY idx_narrative_audit_event (event_type),
  KEY idx_narrative_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 211_create_runtime_failover.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_failover (
  id                VARCHAR(26)   NOT NULL,
  failover_id       VARCHAR(128)  NOT NULL,
  failover_type     VARCHAR(64)   NOT NULL,
  status            VARCHAR(32)   NOT NULL DEFAULT 'pending',
  source_server_id  VARCHAR(128)  NOT NULL,
  target_server_id  VARCHAR(128)  NOT NULL,
  failover_nonce    VARCHAR(128)  NOT NULL,
  failover_data     TEXT          NOT NULL DEFAULT '{}',
  started_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at      DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_failover_id (failover_id),
  UNIQUE KEY uk_failover_nonce (failover_nonce),
  KEY idx_failover_status (status),
  KEY idx_failover_source (source_server_id),
  KEY idx_failover_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 212_create_recovery_snapshots.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_recovery_snapshots (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  snapshot_type   VARCHAR(64)   NOT NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  snapshot_data   TEXT          NOT NULL DEFAULT '{}',
  sequence_number INT           NOT NULL DEFAULT 0,
  is_applied      TINYINT(1)    NOT NULL DEFAULT 0,
  applied_at      DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_recovery_snapshot_entity (entity_id),
  KEY idx_recovery_snapshot_applied (is_applied),
  KEY idx_recovery_snapshot_server (owner_server_id),
  KEY idx_recovery_snapshot_seq (sequence_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 213_create_chaos_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_chaos_runtime (
  id               VARCHAR(26)   NOT NULL,
  test_id          VARCHAR(128)  NOT NULL,
  test_type        VARCHAR(64)   NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'pending',
  target_server_id VARCHAR(128)  NULL,
  chaos_data       TEXT          NOT NULL DEFAULT '{}',
  started_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_chaos_test_id (test_id),
  KEY idx_chaos_status (status),
  KEY idx_chaos_target (target_server_id),
  KEY idx_chaos_type (test_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 214_create_runtime_resilience.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_resilience (
  id              VARCHAR(26)   NOT NULL,
  record_id       VARCHAR(128)  NOT NULL,
  resilience_type VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'healthy',
  owner_server_id VARCHAR(128)  NOT NULL,
  health_score    INT           NOT NULL DEFAULT 100,
  resilience_data TEXT          NOT NULL DEFAULT '{}',
  last_check_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_resilience_record_id (record_id),
  KEY idx_resilience_status (status),
  KEY idx_resilience_server (owner_server_id),
  KEY idx_resilience_health (health_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 215_create_failover_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_failover_audit (
  id          VARCHAR(26)   NOT NULL,
  failover_id VARCHAR(128)  NULL,
  event_type  VARCHAR(128)  NOT NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_failover_audit_failover (failover_id),
  KEY idx_failover_audit_event (event_type),
  KEY idx_failover_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 216_create_recovery_operations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_recovery_operations (
  id              VARCHAR(26)   NOT NULL,
  operation_id    VARCHAR(128)  NOT NULL,
  operation_type  VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  entity_id       VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  recovery_data   TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_recovery_operation_id (operation_id),
  KEY idx_recovery_op_status (status),
  KEY idx_recovery_op_entity (entity_id),
  KEY idx_recovery_op_server (owner_server_id),
  KEY idx_recovery_op_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 217_create_runtime_traces.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_traces (
  id              VARCHAR(26)   NOT NULL,
  trace_id        VARCHAR(128)  NOT NULL,
  trace_type      VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  source_node     VARCHAR(128)  NOT NULL,
  target_node     VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  trace_nonce     VARCHAR(128)  NOT NULL,
  trace_data      TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_trace_nonce (trace_nonce),
  KEY idx_trace_status (status),
  KEY idx_trace_owner (owner_server_id),
  KEY idx_trace_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 218_create_runtime_metrics.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_metrics (
  id              VARCHAR(26)   NOT NULL,
  metric_id       VARCHAR(128)  NOT NULL,
  metric_type     VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  value           DOUBLE        NOT NULL DEFAULT 0,
  unit            VARCHAR(32)   NULL,
  metric_data     TEXT          NOT NULL DEFAULT '{}',
  recorded_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_metric_entity (entity_id),
  KEY idx_metric_type (metric_type),
  KEY idx_metric_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 219_create_failure_correlation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_failure_correlation (
  id               VARCHAR(26)   NOT NULL,
  correlation_id   VARCHAR(128)  NOT NULL,
  failure_type     VARCHAR(64)   NOT NULL,
  source_node      VARCHAR(128)  NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'open',
  owner_server_id  VARCHAR(128)  NOT NULL,
  correlation_data TEXT          NOT NULL DEFAULT '{}',
  correlated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at      DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_correlation_id (correlation_id),
  KEY idx_correlation_status (status),
  KEY idx_correlation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 220_create_runtime_diagnostics.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_diagnostics (
  id              VARCHAR(26)   NOT NULL,
  diagnostic_id   VARCHAR(128)  NOT NULL,
  diagnostic_type VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  diagnostic_data TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_diagnostic_entity (entity_id),
  KEY idx_diagnostic_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 221_create_trace_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_trace_runtime (
  id              VARCHAR(26)   NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  trace_level     VARCHAR(32)   NOT NULL DEFAULT 'info',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id VARCHAR(128)  NOT NULL,
  expires_at      DATETIME(3)   NULL,
  trace_data      TEXT          NOT NULL DEFAULT '{}',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_trace_runtime_entity (entity_id),
  KEY idx_trace_runtime_active (is_active),
  KEY idx_trace_runtime_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 222_create_observability_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_observability_audit (
  id          VARCHAR(26)   NOT NULL,
  trace_id    VARCHAR(128)  NULL,
  event_type  VARCHAR(64)   NOT NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_obs_audit_trace (trace_id),
  KEY idx_obs_audit_event (event_type),
  KEY idx_obs_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 223_create_cluster_nodes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_cluster_nodes (
  id              VARCHAR(26)   NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  node_type       VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  address         VARCHAR(256)  NULL,
  node_nonce      VARCHAR(128)  NOT NULL,
  node_data       TEXT          NOT NULL DEFAULT '{}',
  joined_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at         DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_node_nonce (node_nonce),
  KEY idx_node_status (status),
  KEY idx_node_owner (owner_server_id),
  KEY idx_node_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 224_create_runtime_deployments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_deployments (
  id               VARCHAR(26)   NOT NULL,
  deployment_id    VARCHAR(128)  NOT NULL,
  deployment_type  VARCHAR(64)   NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'pending',
  target_node      VARCHAR(128)  NOT NULL,
  owner_server_id  VARCHAR(128)  NOT NULL,
  deployment_nonce VARCHAR(128)  NOT NULL,
  deployment_data  TEXT          NOT NULL DEFAULT '{}',
  started_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_deployment_nonce (deployment_nonce),
  KEY idx_deployment_status (status),
  KEY idx_deployment_target (target_node),
  KEY idx_deployment_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 225_create_cluster_scaling.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_cluster_scaling (
  id              VARCHAR(26)   NOT NULL,
  scaling_id      VARCHAR(128)  NOT NULL,
  scaling_type    VARCHAR(64)   NOT NULL,
  target_count    INT           NOT NULL DEFAULT 1,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  scaling_nonce   VARCHAR(128)  NOT NULL,
  scaling_data    TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_scaling_nonce (scaling_nonce),
  KEY idx_scaling_status (status),
  KEY idx_scaling_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 226_create_runtime_allocation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_allocation (
  id              VARCHAR(26)   NOT NULL,
  allocation_id   VARCHAR(128)  NOT NULL,
  entity_id       VARCHAR(128)  NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  allocation_data TEXT          NOT NULL DEFAULT '{}',
  allocated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at     DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_allocation_entity (entity_id),
  KEY idx_allocation_node (node_id),
  KEY idx_allocation_status (status),
  KEY idx_allocation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 227_create_node_lifecycle.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_node_lifecycle (
  id              VARCHAR(26)   NOT NULL,
  node_id         VARCHAR(128)  NOT NULL,
  lifecycle_type  VARCHAR(64)   NOT NULL DEFAULT 'standard',
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id VARCHAR(128)  NOT NULL,
  lifecycle_data  TEXT          NOT NULL DEFAULT '{}',
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_node_lifecycle_node_id (node_id),
  KEY idx_node_lifecycle_active (is_active),
  KEY idx_node_lifecycle_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 228_create_cluster_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_cluster_audit (
  id          VARCHAR(26)   NOT NULL,
  node_id     VARCHAR(128)  NULL,
  event_type  VARCHAR(64)   NOT NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_cluster_audit_node (node_id),
  KEY idx_cluster_audit_event (event_type),
  KEY idx_cluster_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 229_create_global_snapshots.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_global_snapshots (
  id              VARCHAR(26)   NOT NULL,
  snapshot_id     VARCHAR(128)  NOT NULL,
  snapshot_type   VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  snapshot_nonce  VARCHAR(128)  NOT NULL,
  snapshot_data   TEXT          NOT NULL DEFAULT '{}',
  taken_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_snapshot_nonce (snapshot_nonce),
  KEY idx_snapshot_status (status),
  KEY idx_snapshot_owner (owner_server_id),
  KEY idx_snapshot_entity (entity_id),
  KEY idx_snapshot_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 230_create_snapshot_archives.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_snapshot_archives (
  id                 VARCHAR(26)   NOT NULL,
  archive_id         VARCHAR(128)  NOT NULL,
  source_snapshot_id VARCHAR(128)  NOT NULL,
  archive_type       VARCHAR(64)   NOT NULL,
  compression_type   VARCHAR(32)   NULL,
  status             VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id    VARCHAR(128)  NOT NULL,
  archive_nonce      VARCHAR(128)  NOT NULL,
  archive_data       TEXT          NOT NULL DEFAULT '{}',
  archived_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at       DATETIME(3)   NULL,
  created_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_archive_nonce (archive_nonce),
  KEY idx_archive_source (source_snapshot_id),
  KEY idx_archive_status (status),
  KEY idx_archive_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 231_create_persistence_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_persistence_runtime (
  id               VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  persistence_type VARCHAR(64)   NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'active',
  is_active        TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id  VARCHAR(128)  NOT NULL,
  persistence_data TEXT          NOT NULL DEFAULT '{}',
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_persistence_runtime_entity (entity_id),
  KEY idx_persistence_active (is_active),
  KEY idx_persistence_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 232_create_snapshot_compression.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_snapshot_compression (
  id                VARCHAR(26)   NOT NULL,
  compression_id    VARCHAR(128)  NOT NULL,
  snapshot_id       VARCHAR(128)  NOT NULL,
  compression_type  VARCHAR(64)   NOT NULL,
  status            VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128)  NOT NULL,
  compression_nonce VARCHAR(128)  NOT NULL,
  compression_data  TEXT          NOT NULL DEFAULT '{}',
  started_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at      DATETIME(3)   NULL,
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_compression_nonce (compression_nonce),
  KEY idx_compression_snapshot (snapshot_id),
  KEY idx_compression_status (status),
  KEY idx_compression_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 233_create_longterm_recovery.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_longterm_recovery (
  id              VARCHAR(26)   NOT NULL,
  recovery_id     VARCHAR(128)  NOT NULL,
  recovery_type   VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  recovery_nonce  VARCHAR(128)  NOT NULL,
  recovery_data   TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_recovery_nonce (recovery_nonce),
  KEY idx_recovery_status (status),
  KEY idx_recovery_entity (entity_id),
  KEY idx_recovery_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 234_create_persistence_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_persistence_audit (
  id          VARCHAR(26)   NOT NULL,
  snapshot_id VARCHAR(128)  NULL,
  event_type  VARCHAR(64)   NOT NULL,
  audit_data  TEXT          NOT NULL DEFAULT '{}',
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_persistence_audit_snapshot (snapshot_id),
  KEY idx_persistence_audit_event (event_type),
  KEY idx_persistence_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 235_create_federation_nodes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_federation_nodes (
  id              VARCHAR(26)  NOT NULL,
  node_id         VARCHAR(26)  NOT NULL,
  node_type       ENUM('game_server','api_server','edge_node','hub_node','relay_node','custom') NOT NULL,
  status          ENUM('active','draining','offline','maintenance') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  region_id       VARCHAR(128) NULL,
  address         VARCHAR(256) NULL,
  node_nonce      VARCHAR(128) NOT NULL,
  node_data       JSON         NOT NULL,
  joined_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at         DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_federation_node_id (node_id),
  UNIQUE KEY uq_federation_node_nonce (node_nonce, owner_server_id),
  KEY idx_federation_nodes_status (status),
  KEY idx_federation_nodes_region (region_id),
  KEY idx_federation_nodes_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 236_create_region_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_region_runtime (
  id              VARCHAR(26)  NOT NULL,
  region_id       VARCHAR(128) NOT NULL,
  region_type     ENUM('primary','secondary','edge','backup','custom') NOT NULL,
  status          ENUM('active','syncing','stale','offline') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  sync_nonce      VARCHAR(128) NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  region_data     JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_region_runtime_region_id (region_id),
  KEY idx_region_runtime_status (status),
  KEY idx_region_runtime_active (is_active),
  KEY idx_region_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 237_create_intercluster_routes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_intercluster_routes (
  id              VARCHAR(26)  NOT NULL,
  route_id        VARCHAR(26)  NOT NULL,
  source_cluster  VARCHAR(128) NOT NULL,
  target_cluster  VARCHAR(128) NOT NULL,
  route_type      ENUM('direct','relay','failover','broadcast','custom') NOT NULL,
  status          ENUM('active','inactive','failed') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  route_nonce     VARCHAR(128) NOT NULL,
  route_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_intercluster_route_id (route_id),
  UNIQUE KEY uq_intercluster_route_nonce (route_nonce, owner_server_id),
  KEY idx_intercluster_routes_status (status),
  KEY idx_intercluster_routes_clusters (source_cluster, target_cluster),
  KEY idx_intercluster_routes_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 238_create_federation_ownership.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_federation_ownership (
  id               VARCHAR(26)  NOT NULL,
  ownership_id     VARCHAR(26)  NOT NULL,
  entity_id        VARCHAR(128) NOT NULL,
  owner_cluster_id VARCHAR(128) NOT NULL,
  ownership_type   ENUM('exclusive','shared','leased','delegated','custom') NOT NULL,
  status           ENUM('active','transferred','released') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  ownership_data   JSON         NOT NULL,
  claimed_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_federation_ownership_entity (entity_id),
  KEY idx_federation_ownership_status (status),
  KEY idx_federation_ownership_cluster (owner_cluster_id),
  KEY idx_federation_ownership_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 239_create_regional_consistency.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_regional_consistency (
  id              VARCHAR(26)  NOT NULL,
  check_id        VARCHAR(26)  NOT NULL,
  region_id       VARCHAR(128) NOT NULL,
  check_type      ENUM('hash','count','timestamp','full','custom') NOT NULL,
  status          ENUM('pending','passed','failed','skipped') NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  check_nonce     VARCHAR(128) NOT NULL,
  completed_at    DATETIME(3)  NULL,
  check_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_regional_consistency_check_id (check_id),
  UNIQUE KEY uq_regional_consistency_nonce (check_nonce, owner_server_id),
  KEY idx_regional_consistency_region (region_id),
  KEY idx_regional_consistency_status (status),
  KEY idx_regional_consistency_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 240_create_federation_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_federation_audit (
  id                 VARCHAR(26)  NOT NULL,
  event_type         VARCHAR(128) NOT NULL,
  federation_node_id VARCHAR(128) NULL,
  region_id          VARCHAR(128) NULL,
  entity_id          VARCHAR(128) NULL,
  owner_server_id    VARCHAR(128) NULL,
  audit_data         JSON         NOT NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_federation_audit_event_type (event_type),
  KEY idx_federation_audit_region (region_id),
  KEY idx_federation_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 241_create_runtime_intrusions.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_intrusions (
  id              VARCHAR(26)  NOT NULL,
  intrusion_id    VARCHAR(26)  NOT NULL,
  intrusion_type  ENUM('unauthorized_access','rate_limit_breach','replay_attack','injection','tampering','custom') NOT NULL,
  status          ENUM('active','investigating','resolved','false_positive') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  entity_id       VARCHAR(128) NULL,
  source_node     VARCHAR(256) NULL,
  intrusion_nonce VARCHAR(128) NOT NULL,
  resolved_at     DATETIME(3)  NULL,
  intrusion_data  JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_intrusion_id (intrusion_id),
  UNIQUE KEY uq_runtime_intrusion_nonce (intrusion_nonce, owner_server_id),
  KEY idx_runtime_intrusions_status (status),
  KEY idx_runtime_intrusions_entity (entity_id),
  KEY idx_runtime_intrusions_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 242_create_runtime_threats.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_threats (
  id              VARCHAR(26)  NOT NULL,
  threat_id       VARCHAR(26)  NOT NULL,
  threat_type     ENUM('botnet','exploit','dos','data_leak','privilege_escalation','custom') NOT NULL,
  severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status          ENUM('active','mitigated','resolved','escalated') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  entity_id       VARCHAR(128) NULL,
  threat_nonce    VARCHAR(128) NOT NULL,
  resolved_at     DATETIME(3)  NULL,
  threat_data     JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_threat_id (threat_id),
  UNIQUE KEY uq_runtime_threat_nonce (threat_nonce, owner_server_id),
  KEY idx_runtime_threats_status (status),
  KEY idx_runtime_threats_severity (severity),
  KEY idx_runtime_threats_entity (entity_id),
  KEY idx_runtime_threats_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 243_create_runtime_isolation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_isolation (
  id              VARCHAR(26)  NOT NULL,
  isolation_id    VARCHAR(26)  NOT NULL,
  entity_id       VARCHAR(128) NOT NULL,
  isolation_type  ENUM('player','server','resource','session','custom') NOT NULL,
  status          ENUM('isolated','quarantined','released') NOT NULL DEFAULT 'isolated',
  owner_server_id VARCHAR(128) NOT NULL,
  isolation_data  JSON         NOT NULL,
  isolated_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at     DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_isolation_entity (entity_id),
  KEY idx_runtime_isolation_status (status),
  KEY idx_runtime_isolation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 244_create_security_escalations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_security_escalations (
  id               VARCHAR(26)  NOT NULL,
  escalation_id    VARCHAR(26)  NOT NULL,
  escalation_type  ENUM('admin_review','automated_ban','service_isolation','emergency_shutdown','custom') NOT NULL,
  status           ENUM('pending','active','resolved','dismissed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  entity_id        VARCHAR(128) NULL,
  escalation_nonce VARCHAR(128) NOT NULL,
  resolved_at      DATETIME(3)  NULL,
  escalation_data  JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_security_escalation_id (escalation_id),
  UNIQUE KEY uq_security_escalation_nonce (escalation_nonce, owner_server_id),
  KEY idx_security_escalations_status (status),
  KEY idx_security_escalations_entity (entity_id),
  KEY idx_security_escalations_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 245_create_threat_containment.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_threat_containment (
  id               VARCHAR(26)  NOT NULL,
  containment_id   VARCHAR(26)  NOT NULL,
  entity_id        VARCHAR(128) NOT NULL,
  containment_type ENUM('block','throttle','isolate','terminate','custom') NOT NULL,
  status           ENUM('active','completed','failed','released') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  containment_nonce VARCHAR(128) NOT NULL,
  completed_at     DATETIME(3)  NULL,
  containment_data JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_threat_containment_id (containment_id),
  UNIQUE KEY uq_threat_containment_nonce (containment_nonce, owner_server_id),
  KEY idx_threat_containment_entity (entity_id),
  KEY idx_threat_containment_status (status),
  KEY idx_threat_containment_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 246_create_security_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_security_audit (
  id              VARCHAR(26)  NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  entity_id       VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_security_audit_event_type (event_type),
  KEY idx_security_audit_entity (entity_id),
  KEY idx_security_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 247_create_economy_regulation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_economy_regulation (
  id               VARCHAR(26)  NOT NULL,
  regulation_id    VARCHAR(26)  NOT NULL,
  region_id        VARCHAR(128) NULL,
  regulation_type  ENUM('price_floor','price_ceiling','supply_cap','demand_cap','subsidy','custom') NOT NULL,
  status           ENUM('active','suspended','expired','cancelled') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  regulation_nonce VARCHAR(128) NOT NULL,
  regulation_data  JSON         NOT NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_economy_regulation_id (regulation_id),
  UNIQUE KEY uq_economy_regulation_nonce (regulation_nonce, owner_server_id),
  KEY idx_economy_regulation_status (status),
  KEY idx_economy_regulation_region (region_id),
  KEY idx_economy_regulation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 248_create_resource_balancing.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_resource_balancing (
  id               VARCHAR(26)  NOT NULL,
  balancing_id     VARCHAR(26)  NOT NULL,
  resource_type    ENUM('cash','goods','property','jobs','housing','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  balancing_nonce  VARCHAR(128) NOT NULL,
  target_region_id VARCHAR(128) NULL,
  balancing_data   JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_resource_balancing_id (balancing_id),
  UNIQUE KEY uq_resource_balancing_nonce (balancing_nonce, owner_server_id),
  KEY idx_resource_balancing_status (status),
  KEY idx_resource_balancing_region (target_region_id),
  KEY idx_resource_balancing_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 249_create_market_stabilization.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_market_stabilization (
  id                  VARCHAR(26)  NOT NULL,
  stabilization_id    VARCHAR(26)  NOT NULL,
  market_type         ENUM('goods','services','real_estate','labor','financial','custom') NOT NULL,
  status              ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  stabilization_nonce VARCHAR(128) NOT NULL,
  region_id           VARCHAR(128) NULL,
  stabilization_data  JSON         NOT NULL,
  completed_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_market_stabilization_id (stabilization_id),
  UNIQUE KEY uq_market_stabilization_nonce (stabilization_nonce, owner_server_id),
  KEY idx_market_stabilization_status (status),
  KEY idx_market_stabilization_region (region_id),
  KEY idx_market_stabilization_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 250_create_tax_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_tax_runtime (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  tax_type        ENUM('income','sales','property','corporate','import','custom') NOT NULL,
  rate            DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  status          ENUM('active','suspended','modified') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128)  NOT NULL,
  tax_data        JSON          NOT NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tax_runtime_region (region_id),
  KEY idx_tax_runtime_status (status),
  KEY idx_tax_runtime_active (is_active),
  KEY idx_tax_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 251_create_inflation_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_inflation_runtime (
  id              VARCHAR(26)   NOT NULL,
  region_id       VARCHAR(128)  NOT NULL,
  inflation_rate  DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  status          ENUM('stable','inflationary','deflationary','hyperinflationary') NOT NULL DEFAULT 'stable',
  owner_server_id VARCHAR(128)  NOT NULL,
  inflation_data  JSON          NOT NULL,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  measured_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_inflation_runtime_region (region_id),
  KEY idx_inflation_runtime_status (status),
  KEY idx_inflation_runtime_active (is_active),
  KEY idx_inflation_runtime_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 252_create_economy_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_economy_audit (
  id              VARCHAR(26)  NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  region_id       VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_economy_audit_event_type (event_type),
  KEY idx_economy_audit_region (region_id),
  KEY idx_economy_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 253_create_governance_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_governance_runtime (
  id               VARCHAR(26)  NOT NULL,
  governance_id    VARCHAR(26)  NOT NULL,
  governance_type  ENUM('democracy','oligarchy','autocracy','federation','custom') NOT NULL,
  status           ENUM('active','suspended','dissolved','transitioning') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  governance_nonce VARCHAR(128) NOT NULL,
  governance_data  JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_governance_id (governance_id),
  UNIQUE KEY uq_governance_nonce (governance_nonce, owner_server_id),
  KEY idx_governance_status (status),
  KEY idx_governance_region (region_id),
  KEY idx_governance_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 254_create_political_elections.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_political_elections (
  id              VARCHAR(26)  NOT NULL,
  election_id     VARCHAR(26)  NOT NULL,
  election_type   ENUM('general','regional','emergency','referendum','custom') NOT NULL,
  status          ENUM('open','closed','cancelled','counting') NOT NULL DEFAULT 'open',
  owner_server_id VARCHAR(128) NOT NULL,
  region_id       VARCHAR(128) NOT NULL,
  election_nonce  VARCHAR(128) NOT NULL,
  candidate_data  JSON         NOT NULL,
  result_data     JSON         NULL,
  closed_at       DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_election_id (election_id),
  UNIQUE KEY uq_election_nonce (election_nonce, owner_server_id),
  KEY idx_election_status (status),
  KEY idx_election_region (region_id),
  KEY idx_election_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 255_create_legislative_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_legislative_runtime (
  id                  VARCHAR(26)  NOT NULL,
  legislation_id      VARCHAR(26)  NOT NULL,
  legislation_type    ENUM('law','regulation','ordinance','decree','custom') NOT NULL,
  status              ENUM('active','repealed','expired','draft') NOT NULL DEFAULT 'active',
  owner_server_id     VARCHAR(128) NOT NULL,
  region_id           VARCHAR(128) NULL,
  legislation_nonce   VARCHAR(128) NOT NULL,
  legislation_data    JSON         NOT NULL,
  enacted_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at          DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_legislation_id (legislation_id),
  UNIQUE KEY uq_legislation_nonce (legislation_nonce, owner_server_id),
  KEY idx_legislation_status (status),
  KEY idx_legislation_region (region_id),
  KEY idx_legislation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 256_create_civic_influence.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_civic_influence (
  id               VARCHAR(26)     NOT NULL,
  entity_id        VARCHAR(128)    NOT NULL,
  influence_type   ENUM('political','economic','social','military','custom') NOT NULL,
  influence_score  DECIMAL(10,4)   NOT NULL DEFAULT 0.0000,
  owner_server_id  VARCHAR(128)    NOT NULL,
  region_id        VARCHAR(128)    NULL,
  influence_data   JSON            NOT NULL,
  created_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_civic_influence_entity (entity_id),
  KEY idx_civic_influence_type (influence_type),
  KEY idx_civic_influence_region (region_id),
  KEY idx_civic_influence_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 257_create_policy_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_policy_runtime (
  id               VARCHAR(26)  NOT NULL,
  policy_id        VARCHAR(26)  NOT NULL,
  policy_type      ENUM('economic','social','military','environmental','governance','custom') NOT NULL,
  status           ENUM('active','revoked','expired','pending') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  policy_nonce     VARCHAR(128) NOT NULL,
  policy_data      JSON         NOT NULL,
  applied_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_policy_id (policy_id),
  UNIQUE KEY uq_policy_nonce (policy_nonce, owner_server_id),
  KEY idx_policy_status (status),
  KEY idx_policy_region (region_id),
  KEY idx_policy_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 258_create_governance_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_governance_audit (
  id               VARCHAR(26)  NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  governance_id    VARCHAR(26)  NULL,
  entity_id        VARCHAR(128) NULL,
  region_id        VARCHAR(128) NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_governance_audit_event (event_type),
  KEY idx_governance_audit_governance (governance_id),
  KEY idx_governance_audit_region (region_id),
  KEY idx_governance_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 259_create_ecology_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ecology_runtime (
  id               VARCHAR(26)  NOT NULL,
  ecology_id       VARCHAR(26)  NOT NULL,
  ecology_type     ENUM('forest','ocean','desert','tundra','urban','custom') NOT NULL,
  status           ENUM('stable','degrading','recovering','critical') NOT NULL DEFAULT 'stable',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  ecology_nonce    VARCHAR(128) NOT NULL,
  ecology_data     JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_ecology_id (ecology_id),
  UNIQUE KEY uq_ecology_nonce (ecology_nonce, owner_server_id),
  KEY idx_ecology_status (status),
  KEY idx_ecology_region (region_id),
  KEY idx_ecology_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 260_create_environmental_evolution.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_environmental_evolution (
  id               VARCHAR(26)  NOT NULL,
  evolution_id     VARCHAR(26)  NOT NULL,
  evolution_type   ENUM('climate_shift','biome_change','species_migration','pollution','restoration','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  region_id        VARCHAR(128) NULL,
  evolution_nonce  VARCHAR(128) NOT NULL,
  evolution_data   JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evolution_id (evolution_id),
  UNIQUE KEY uq_evolution_nonce (evolution_nonce, owner_server_id),
  KEY idx_evolution_status (status),
  KEY idx_evolution_region (region_id),
  KEY idx_evolution_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 261_create_resource_regeneration.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_resource_regeneration (
  id                  VARCHAR(26)  NOT NULL,
  regeneration_id     VARCHAR(26)  NOT NULL,
  resource_type       ENUM('flora','fauna','mineral','water','soil','custom') NOT NULL,
  status              ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  region_id           VARCHAR(128) NULL,
  regeneration_nonce  VARCHAR(128) NOT NULL,
  regeneration_data   JSON         NOT NULL,
  completed_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_regeneration_id (regeneration_id),
  UNIQUE KEY uq_regeneration_nonce (regeneration_nonce, owner_server_id),
  KEY idx_regeneration_status (status),
  KEY idx_regeneration_region (region_id),
  KEY idx_regeneration_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 262_create_climate_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_climate_runtime (
  id               VARCHAR(26)   NOT NULL,
  region_id        VARCHAR(128)  NOT NULL,
  climate_type     ENUM('tropical','temperate','arctic','arid','continental','custom') NOT NULL,
  status           ENUM('stable','changing','extreme','recovering') NOT NULL DEFAULT 'stable',
  owner_server_id  VARCHAR(128)  NOT NULL,
  temperature      DECIMAL(8,4)  NOT NULL DEFAULT 0.0000,
  humidity         DECIMAL(8,4)  NOT NULL DEFAULT 0.0000,
  climate_data     JSON          NOT NULL,
  measured_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_climate_region (region_id),
  KEY idx_climate_status (status),
  KEY idx_climate_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 263_create_wildlife_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_wildlife_runtime (
  id               VARCHAR(26)   NOT NULL,
  zone_id          VARCHAR(128)  NOT NULL,
  wildlife_type    ENUM('predator','prey','scavenger','herbivore','marine','custom') NOT NULL,
  status           ENUM('thriving','stable','declining','endangered','extinct') NOT NULL DEFAULT 'stable',
  owner_server_id  VARCHAR(128)  NOT NULL,
  population       INT UNSIGNED  NOT NULL DEFAULT 0,
  wildlife_data    JSON          NOT NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_wildlife_zone (zone_id),
  KEY idx_wildlife_status (status),
  KEY idx_wildlife_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 264_create_ecology_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_ecology_audit (
  id               VARCHAR(26)  NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  ecology_id       VARCHAR(26)  NULL,
  region_id        VARCHAR(128) NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ecology_audit_event (event_type),
  KEY idx_ecology_audit_ecology (ecology_id),
  KEY idx_ecology_audit_region (region_id),
  KEY idx_ecology_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 265_create_meta_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_meta_runtime (
  id               VARCHAR(26)  NOT NULL,
  meta_id          VARCHAR(26)  NOT NULL,
  meta_type        ENUM('orchestrator','scheduler','balancer','watchdog','coordinator','custom') NOT NULL,
  status           ENUM('active','paused','terminated','degraded') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  meta_nonce       VARCHAR(128) NOT NULL,
  meta_data        JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_meta_id (meta_id),
  UNIQUE KEY uq_meta_nonce (meta_nonce, owner_server_id),
  KEY idx_meta_status (status),
  KEY idx_meta_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 266_create_runtime_healing.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_healing (
  id               VARCHAR(26)  NOT NULL,
  healing_id       VARCHAR(26)  NOT NULL,
  healing_type     ENUM('restart','failover','rollback','rebalance','patch','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_node      VARCHAR(128) NOT NULL,
  healing_nonce    VARCHAR(128) NOT NULL,
  healing_data     JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_healing_id (healing_id),
  UNIQUE KEY uq_healing_nonce (healing_nonce, owner_server_id),
  KEY idx_healing_status (status),
  KEY idx_healing_target (target_node),
  KEY idx_healing_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 267_create_distributed_repair.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_distributed_repair (
  id               VARCHAR(26)  NOT NULL,
  repair_id        VARCHAR(26)  NOT NULL,
  repair_type      ENUM('data_repair','state_sync','schema_fix','consistency_check','index_rebuild','custom') NOT NULL,
  status           ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_node      VARCHAR(128) NOT NULL,
  repair_nonce     VARCHAR(128) NOT NULL,
  repair_data      JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_repair_id (repair_id),
  UNIQUE KEY uq_repair_nonce (repair_nonce, owner_server_id),
  KEY idx_repair_status (status),
  KEY idx_repair_target (target_node),
  KEY idx_repair_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 268_create_meta_allocations.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_meta_allocations (
  id               VARCHAR(26)  NOT NULL,
  entity_id        VARCHAR(128) NOT NULL,
  allocation_type  ENUM('compute','memory','network','storage','process','custom') NOT NULL,
  status           ENUM('allocated','released','overloaded','reserved') NOT NULL DEFAULT 'allocated',
  owner_server_id  VARCHAR(128) NOT NULL,
  allocation_data  JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_meta_allocation_entity (entity_id),
  KEY idx_meta_allocation_type (allocation_type),
  KEY idx_meta_allocation_status (status),
  KEY idx_meta_allocation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 269_create_runtime_coordination.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_coordination (
  id                  VARCHAR(26)  NOT NULL,
  node_id             VARCHAR(128) NOT NULL,
  coordination_type   ENUM('leader','follower','observer','standby','custom') NOT NULL,
  status              ENUM('active','inactive','failed') NOT NULL DEFAULT 'active',
  owner_server_id     VARCHAR(128) NOT NULL,
  coordination_data   JSON         NOT NULL,
  heartbeat_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_coordination_node (node_id),
  KEY idx_coordination_type (coordination_type),
  KEY idx_coordination_status (status),
  KEY idx_coordination_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 270_create_meta_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_meta_audit (
  id               VARCHAR(26)  NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  meta_id          VARCHAR(26)  NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_meta_audit_event (event_type),
  KEY idx_meta_audit_meta (meta_id),
  KEY idx_meta_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 271_create_runtime_protocols.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_protocols (
  id              VARCHAR(26)  NOT NULL,
  protocol_id     VARCHAR(26)  NOT NULL,
  protocol_type   ENUM('negotiation','federation','bridge','handshake','contract','custom') NOT NULL,
  status          ENUM('active','paused','terminated','degraded') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  protocol_nonce  VARCHAR(128) NOT NULL,
  protocol_data   JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_protocol_id (protocol_id),
  UNIQUE KEY uq_protocol_nonce (protocol_nonce, owner_server_id),
  KEY idx_protocol_status (status),
  KEY idx_protocol_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 272_create_federation_contracts.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_federation_contracts (
  id               VARCHAR(26)  NOT NULL,
  contract_id      VARCHAR(26)  NOT NULL,
  contract_type    ENUM('peer','subordinate','primary','relay','custom') NOT NULL,
  status           ENUM('pending','active','expired','revoked') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_server_id VARCHAR(128) NOT NULL,
  contract_nonce   VARCHAR(128) NOT NULL,
  contract_data    JSON         NOT NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_contract_id (contract_id),
  UNIQUE KEY uq_contract_nonce (contract_nonce, owner_server_id),
  KEY idx_contract_status (status),
  KEY idx_contract_owner (owner_server_id),
  KEY idx_contract_target (target_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 273_create_protocol_registry.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_protocol_registry (
  id              VARCHAR(26)  NOT NULL,
  node_id         VARCHAR(128) NOT NULL,
  entry_type      ENUM('service','gateway','broker','proxy','custom') NOT NULL,
  status          ENUM('registered','deregistered','unreachable') NOT NULL DEFAULT 'registered',
  owner_server_id VARCHAR(128) NOT NULL,
  endpoint_data   JSON         NOT NULL,
  registered_at   DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_registry_node (node_id),
  KEY idx_registry_status (status),
  KEY idx_registry_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 274_create_runtime_handshakes.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_handshakes (
  id               VARCHAR(26)  NOT NULL,
  handshake_id     VARCHAR(26)  NOT NULL,
  handshake_type   ENUM('initiate','acknowledge','complete','reject','timeout','custom') NOT NULL,
  status           ENUM('pending','acknowledged','completed','rejected','timed_out') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  remote_server_id VARCHAR(128) NOT NULL,
  handshake_nonce  VARCHAR(128) NOT NULL,
  handshake_data   JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_handshake_id (handshake_id),
  UNIQUE KEY uq_handshake_nonce (handshake_nonce, owner_server_id),
  KEY idx_handshake_status (status),
  KEY idx_handshake_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 275_create_protocol_bridges.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_protocol_bridges (
  id               VARCHAR(26)  NOT NULL,
  bridge_id        VARCHAR(128) NOT NULL,
  bridge_type      ENUM('grpc','http','websocket','tcp','custom') NOT NULL,
  status           ENUM('active','inactive','failed','draining') NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  remote_server_id VARCHAR(128) NOT NULL,
  bridge_data      JSON         NOT NULL,
  heartbeat_at     DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_bridge_id (bridge_id),
  KEY idx_bridge_status (status),
  KEY idx_bridge_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 276_create_protocol_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_protocol_audit (
  id              VARCHAR(26)  NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  protocol_id     VARCHAR(26)  NULL,
  contract_id     VARCHAR(26)  NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  KEY idx_protocol_audit_type (event_type),
  KEY idx_protocol_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 277_create_runtime_evolution.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_evolution (
  id              VARCHAR(26)  NOT NULL,
  evolution_id    VARCHAR(26)  NOT NULL,
  evolution_type  ENUM('schema','behavior','protocol','topology','config','custom') NOT NULL,
  status          ENUM('pending','active','completed','failed','rolled_back') NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  evolution_nonce VARCHAR(128) NOT NULL,
  evolution_data  JSON         NOT NULL,
  completed_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_evolution_id (evolution_id),
  UNIQUE KEY uq_evolution_nonce (evolution_nonce, owner_server_id),
  KEY idx_evolution_status (status),
  KEY idx_evolution_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 278_create_adaptive_optimization.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_adaptive_optimization (
  id                VARCHAR(26)  NOT NULL,
  optimization_id   VARCHAR(26)  NOT NULL,
  optimization_type ENUM('cpu','memory','latency','throughput','concurrency','custom') NOT NULL,
  status            ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  target_node       VARCHAR(128) NOT NULL,
  optimization_nonce VARCHAR(128) NOT NULL,
  optimization_data  JSON        NOT NULL,
  completed_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_optimization_id (optimization_id),
  UNIQUE KEY uq_optimization_nonce (optimization_nonce, owner_server_id),
  KEY idx_optimization_status (status),
  KEY idx_optimization_owner (owner_server_id),
  KEY idx_optimization_node (target_node)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 279_create_runtime_tuning.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_tuning (
  id              VARCHAR(26)  NOT NULL,
  entity_id       VARCHAR(128) NOT NULL,
  tuning_type     ENUM('threshold','interval','capacity','priority','weight','custom') NOT NULL,
  status          ENUM('active','inactive','superseded') NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  tuning_data     JSON         NOT NULL,
  applied_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tuning_entity (entity_id),
  KEY idx_tuning_status (status),
  KEY idx_tuning_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 280_create_autonomous_evolution.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_autonomous_evolution (
  id               VARCHAR(26)  NOT NULL,
  autonomous_id    VARCHAR(26)  NOT NULL,
  autonomous_type  ENUM('self_heal','self_tune','self_scale','self_optimize','custom') NOT NULL,
  status           ENUM('triggered','applying','applied','failed','reverted') NOT NULL DEFAULT 'triggered',
  owner_server_id  VARCHAR(128) NOT NULL,
  autonomous_nonce VARCHAR(128) NOT NULL,
  trigger_data     JSON         NOT NULL,
  outcome_data     JSON         NULL,
  applied_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_autonomous_id (autonomous_id),
  UNIQUE KEY uq_autonomous_nonce (autonomous_nonce, owner_server_id),
  KEY idx_autonomous_status (status),
  KEY idx_autonomous_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 281_create_distributed_optimization.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_distributed_optimization (
  id                 VARCHAR(26)  NOT NULL,
  node_id            VARCHAR(128) NOT NULL,
  opt_type           ENUM('load_balance','shard_rebalance','cache_warm','route_optimize','custom') NOT NULL,
  status             ENUM('active','idle','overloaded','failed') NOT NULL DEFAULT 'active',
  owner_server_id    VARCHAR(128) NOT NULL,
  opt_data           JSON         NOT NULL,
  last_optimized_at  DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_dist_opt_node (node_id),
  KEY idx_dist_opt_status (status),
  KEY idx_dist_opt_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 282_create_evolution_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_evolution_audit (
  id              VARCHAR(26)  NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  evolution_id    VARCHAR(26)  NULL,
  entity_id       VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  KEY idx_evolution_audit_type (event_type),
  KEY idx_evolution_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 283_create_world_integrity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_world_integrity (
  id               VARCHAR(26)  NOT NULL,
  integrity_id     VARCHAR(26)  NOT NULL,
  integrity_type   ENUM('checkpoint','snapshot','hash_verify','state_audit','consistency_check','custom') NOT NULL,
  status           ENUM('pending','active','verified','failed','corrupted') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  integrity_nonce  VARCHAR(128) NOT NULL,
  world_hash       VARCHAR(128) NULL,
  integrity_data   JSON         NOT NULL,
  verified_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_integrity_id (integrity_id),
  UNIQUE KEY uq_integrity_nonce (integrity_nonce, owner_server_id),
  KEY idx_integrity_status (status),
  KEY idx_integrity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 284_create_distributed_locks.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_distributed_locks (
  id              VARCHAR(26)  NOT NULL,
  resource_key    VARCHAR(255) NOT NULL,
  lock_type       ENUM('exclusive','shared','advisory','intent','custom') NOT NULL,
  status          ENUM('acquired','released','expired','contested') NOT NULL DEFAULT 'acquired',
  owner_server_id VARCHAR(128) NOT NULL,
  lock_nonce      VARCHAR(128) NOT NULL,
  expires_at      DATETIME(3)  NULL,
  lock_data       JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_lock_resource (resource_key),
  KEY idx_lock_status (status),
  KEY idx_lock_owner (owner_server_id),
  KEY idx_lock_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 285_create_runtime_consistency.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_consistency (
  id               VARCHAR(26)  NOT NULL,
  node_id          VARCHAR(128) NOT NULL,
  consistency_type ENUM('eventual','strong','causal','sequential','custom') NOT NULL,
  status           ENUM('consistent','diverged','reconciling','unknown') NOT NULL DEFAULT 'consistent',
  owner_server_id  VARCHAR(128) NOT NULL,
  consistency_data JSON         NOT NULL,
  checked_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_consistency_node (node_id),
  KEY idx_consistency_status (status),
  KEY idx_consistency_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 286_create_integrity_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_integrity_validation (
  id               VARCHAR(26)  NOT NULL,
  validation_id    VARCHAR(26)  NOT NULL,
  validation_type  ENUM('world_state','entity_state','transaction','replication','custom') NOT NULL,
  status           ENUM('pending','passed','failed','skipped') NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  target_id        VARCHAR(128) NULL,
  validation_nonce VARCHAR(128) NOT NULL,
  validation_data  JSON         NOT NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_validation_id (validation_id),
  UNIQUE KEY uq_validation_nonce (validation_nonce, owner_server_id),
  KEY idx_validation_status (status),
  KEY idx_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 287_create_world_reconciliation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_world_reconciliation (
  id                   VARCHAR(26)  NOT NULL,
  reconciliation_id    VARCHAR(26)  NOT NULL,
  reconciliation_type  ENUM('delta_sync','full_sync','conflict_resolve','merge','rollback','custom') NOT NULL,
  status               ENUM('pending','active','completed','failed') NOT NULL DEFAULT 'pending',
  owner_server_id      VARCHAR(128) NOT NULL,
  reconciliation_nonce VARCHAR(128) NOT NULL,
  reconciliation_data  JSON         NOT NULL,
  completed_at         DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reconciliation_id (reconciliation_id),
  UNIQUE KEY uq_reconciliation_nonce (reconciliation_nonce, owner_server_id),
  KEY idx_reconciliation_status (status),
  KEY idx_reconciliation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 288_create_integrity_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_integrity_audit (
  id              VARCHAR(26)  NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  integrity_id    VARCHAR(26)  NULL,
  resource_key    VARCHAR(255) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  KEY idx_integrity_audit_type (event_type),
  KEY idx_integrity_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 289_create_global_governance.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_global_governance (
  id               CHAR(26)     NOT NULL,
  directive_id     CHAR(26)     NOT NULL,
  directive_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  directive_nonce  VARCHAR(128) NOT NULL,
  directive_data   JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_governance_directive_id (directive_id),
  UNIQUE KEY uq_global_governance_nonce (directive_nonce, owner_server_id),
  INDEX idx_global_governance_status (status),
  INDEX idx_global_governance_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 290_create_runtime_consensus.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_consensus (
  id               CHAR(26)     NOT NULL,
  consensus_id     CHAR(26)     NOT NULL,
  consensus_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'proposed',
  owner_server_id  VARCHAR(128) NOT NULL,
  consensus_nonce  VARCHAR(128) NOT NULL,
  consensus_data   JSON         NULL,
  committed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_consensus_id (consensus_id),
  UNIQUE KEY uq_runtime_consensus_nonce (consensus_nonce, owner_server_id),
  INDEX idx_runtime_consensus_status (status),
  INDEX idx_runtime_consensus_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 291_create_crosssystem_arbitration.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_crosssystem_arbitration (
  id                 CHAR(26)     NOT NULL,
  arbitration_id     CHAR(26)     NOT NULL,
  arbitration_type   VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id    VARCHAR(128) NOT NULL,
  arbitration_nonce  VARCHAR(128) NOT NULL,
  arbitration_data   JSON         NULL,
  resolved_at        DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crosssystem_arbitration_id (arbitration_id),
  UNIQUE KEY uq_crosssystem_arbitration_nonce (arbitration_nonce, owner_server_id),
  INDEX idx_crosssystem_arbitration_status (status),
  INDEX idx_crosssystem_arbitration_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 292_create_global_policies.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_global_policies (
  id               CHAR(26)     NOT NULL,
  policy_id        VARCHAR(128) NOT NULL,
  policy_type      VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  policy_data      JSON         NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_policies_policy_id (policy_id),
  INDEX idx_global_policies_status (status),
  INDEX idx_global_policies_owner (owner_server_id),
  INDEX idx_global_policies_type (policy_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 293_create_global_ownership.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_global_ownership (
  id               CHAR(26)     NOT NULL,
  resource_id      VARCHAR(128) NOT NULL,
  ownership_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'claimed',
  owner_server_id  VARCHAR(128) NOT NULL,
  ownership_data   JSON         NULL,
  expires_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_ownership_resource_id (resource_id),
  INDEX idx_global_ownership_status (status),
  INDEX idx_global_ownership_owner (owner_server_id),
  INDEX idx_global_ownership_type (ownership_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 294_create_governance_continuity_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_governance_continuity_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(64)  NOT NULL,
  directive_id     CHAR(26)     NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_governance_continuity_audit_event (event_type),
  INDEX idx_governance_continuity_audit_directive (directive_id),
  INDEX idx_governance_continuity_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 295_create_runtime_continuity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_continuity (
  id               CHAR(26)     NOT NULL,
  continuity_id    CHAR(26)     NOT NULL,
  continuity_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  continuity_nonce VARCHAR(128) NOT NULL,
  continuity_data  JSON         NULL,
  terminated_at    DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_continuity_id (continuity_id),
  UNIQUE KEY uq_runtime_continuity_nonce (continuity_nonce, owner_server_id),
  INDEX idx_runtime_continuity_status (status),
  INDEX idx_runtime_continuity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 296_create_temporal_recovery.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_temporal_recovery (
  id                 CHAR(26)     NOT NULL,
  recovery_id        CHAR(26)     NOT NULL,
  recovery_type      VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id    VARCHAR(128) NOT NULL,
  recovery_nonce     VARCHAR(128) NOT NULL,
  target_timestamp   DATETIME(3)  NULL,
  recovery_data      JSON         NULL,
  completed_at       DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_temporal_recovery_id (recovery_id),
  UNIQUE KEY uq_temporal_recovery_nonce (recovery_nonce, owner_server_id),
  INDEX idx_temporal_recovery_status (status),
  INDEX idx_temporal_recovery_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 297_create_checkpoint_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_checkpoint_runtime (
  id                CHAR(26)     NOT NULL,
  checkpoint_id     CHAR(26)     NOT NULL,
  checkpoint_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  checkpoint_nonce  VARCHAR(128) NOT NULL,
  checkpoint_data   JSON         NULL,
  committed_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkpoint_runtime_id (checkpoint_id),
  UNIQUE KEY uq_checkpoint_runtime_nonce (checkpoint_nonce, owner_server_id),
  INDEX idx_checkpoint_runtime_status (status),
  INDEX idx_checkpoint_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 298_create_infinite_persistence.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_infinite_persistence (
  id                CHAR(26)     NOT NULL,
  node_id           VARCHAR(128) NOT NULL,
  node_type         VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id   VARCHAR(128) NOT NULL,
  persistence_data  JSON         NULL,
  synced_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infinite_persistence_node_id (node_id),
  INDEX idx_infinite_persistence_status (status),
  INDEX idx_infinite_persistence_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 299_create_temporal_integrity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_temporal_integrity (
  id               CHAR(26)     NOT NULL,
  integrity_id     CHAR(26)     NOT NULL,
  integrity_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'unknown',
  owner_server_id  VARCHAR(128) NOT NULL,
  integrity_nonce  VARCHAR(128) NOT NULL,
  integrity_data   JSON         NULL,
  repaired_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_temporal_integrity_id (integrity_id),
  UNIQUE KEY uq_temporal_integrity_nonce (integrity_nonce, owner_server_id),
  INDEX idx_temporal_integrity_status (status),
  INDEX idx_temporal_integrity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 300_create_continuity_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_continuity_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(64)  NOT NULL,
  continuity_id    CHAR(26)     NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_continuity_audit_event (event_type),
  INDEX idx_continuity_audit_continuity (continuity_id),
  INDEX idx_continuity_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 301_create_runtime_lockdown.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_lockdown (
  id               CHAR(26)     NOT NULL,
  lockdown_id      CHAR(26)     NOT NULL,
  lockdown_type    VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'initiated',
  owner_server_id  VARCHAR(128) NOT NULL,
  lockdown_nonce   VARCHAR(128) NOT NULL,
  lockdown_data    JSON         NULL,
  lifted_at        DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_lockdown_id (lockdown_id),
  UNIQUE KEY uq_runtime_lockdown_nonce (lockdown_nonce, owner_server_id),
  INDEX idx_runtime_lockdown_status (status),
  INDEX idx_runtime_lockdown_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 302_create_production_integrity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_production_integrity (
  id               CHAR(26)     NOT NULL,
  integrity_id     CHAR(26)     NOT NULL,
  integrity_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  integrity_nonce  VARCHAR(128) NOT NULL,
  integrity_data   JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_integrity_id (integrity_id),
  UNIQUE KEY uq_production_integrity_nonce (integrity_nonce, owner_server_id),
  INDEX idx_production_integrity_status (status),
  INDEX idx_production_integrity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 303_create_runtime_seals.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_seals (
  id               CHAR(26)     NOT NULL,
  seal_id          CHAR(26)     NOT NULL,
  seal_type        VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'applied',
  owner_server_id  VARCHAR(128) NOT NULL,
  resource_id      VARCHAR(128) NOT NULL,
  seal_nonce       VARCHAR(128) NOT NULL,
  seal_data        JSON         NULL,
  verified_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_seals_id (seal_id),
  UNIQUE KEY uq_runtime_seals_nonce (seal_nonce, owner_server_id),
  INDEX idx_runtime_seals_status (status),
  INDEX idx_runtime_seals_resource (resource_id),
  INDEX idx_runtime_seals_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 304_create_finalization_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_finalization_runtime (
  id                  CHAR(26)     NOT NULL,
  finalization_id     CHAR(26)     NOT NULL,
  finalization_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  finalization_nonce  VARCHAR(128) NOT NULL,
  finalization_data   JSON         NULL,
  finalized_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_finalization_runtime_id (finalization_id),
  UNIQUE KEY uq_finalization_runtime_nonce (finalization_nonce, owner_server_id),
  INDEX idx_finalization_runtime_status (status),
  INDEX idx_finalization_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 305_create_lockdown_recovery.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_lockdown_recovery (
  id               CHAR(26)     NOT NULL,
  closure_id       CHAR(26)     NOT NULL,
  closure_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  closure_nonce    VARCHAR(128) NOT NULL,
  closure_data     JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_lockdown_recovery_closure_id (closure_id),
  UNIQUE KEY uq_lockdown_recovery_nonce (closure_nonce, owner_server_id),
  INDEX idx_lockdown_recovery_status (status),
  INDEX idx_lockdown_recovery_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 306_create_lockdown_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_lockdown_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(64)  NOT NULL,
  lockdown_id      CHAR(26)     NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_lockdown_audit_event (event_type),
  INDEX idx_lockdown_audit_lockdown (lockdown_id),
  INDEX idx_lockdown_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 307_create_runtime_certification.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_certification (
  id                   CHAR(26)     NOT NULL,
  certification_id     CHAR(26)     NOT NULL,
  certification_type   VARCHAR(32)  NOT NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id      VARCHAR(128) NOT NULL,
  certification_nonce  VARCHAR(128) NOT NULL,
  certification_data   JSON         NULL,
  certified_at         DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_certification_id (certification_id),
  UNIQUE KEY uq_runtime_certification_nonce (certification_nonce, owner_server_id),
  INDEX idx_runtime_certification_status (status),
  INDEX idx_runtime_certification_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 308_create_deterministic_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_deterministic_validation (
  id               CHAR(26)     NOT NULL,
  validation_id    CHAR(26)     NOT NULL,
  validation_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  validation_nonce VARCHAR(128) NOT NULL,
  validation_data  JSON         NULL,
  validated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_deterministic_validation_id (validation_id),
  UNIQUE KEY uq_deterministic_validation_nonce (validation_nonce, owner_server_id),
  INDEX idx_deterministic_validation_status (status),
  INDEX idx_deterministic_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 309_create_runtime_compliance.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_compliance (
  id               CHAR(26)     NOT NULL,
  compliance_id    CHAR(26)     NOT NULL,
  compliance_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  compliance_nonce VARCHAR(128) NOT NULL,
  compliance_data  JSON         NULL,
  enforced_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_compliance_id (compliance_id),
  UNIQUE KEY uq_runtime_compliance_nonce (compliance_nonce, owner_server_id),
  INDEX idx_runtime_compliance_status (status),
  INDEX idx_runtime_compliance_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 310_create_verification_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_verification_runtime (
  id                  CHAR(26)     NOT NULL,
  verification_id     CHAR(26)     NOT NULL,
  verification_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  verification_nonce  VARCHAR(128) NOT NULL,
  verification_data   JSON         NULL,
  verified_at         DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_verification_runtime_id (verification_id),
  UNIQUE KEY uq_verification_runtime_nonce (verification_nonce, owner_server_id),
  INDEX idx_verification_runtime_status (status),
  INDEX idx_verification_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 311_create_compliance_coordination.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_compliance_coordination (
  id                CHAR(26)     NOT NULL,
  coordination_id   VARCHAR(128) NOT NULL,
  coordination_type VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id   VARCHAR(128) NOT NULL,
  coordination_data JSON         NULL,
  synced_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_compliance_coordination_id (coordination_id),
  INDEX idx_compliance_coordination_status (status),
  INDEX idx_compliance_coordination_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 312_create_certification_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_certification_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  certification_id VARCHAR(128) NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_certification_audit_event (event_type),
  INDEX idx_certification_audit_cert (certification_id),
  INDEX idx_certification_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 313_create_runtime_sovereignty.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_sovereignty (
  id                 CHAR(26)     NOT NULL,
  sovereignty_id     CHAR(26)     NOT NULL,
  sovereignty_type   VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'establishing',
  owner_server_id    VARCHAR(128) NOT NULL,
  sovereignty_nonce  VARCHAR(128) NOT NULL,
  sovereignty_data   JSON         NULL,
  established_at     DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_sovereignty_id (sovereignty_id),
  UNIQUE KEY uq_runtime_sovereignty_nonce (sovereignty_nonce, owner_server_id),
  INDEX idx_runtime_sovereignty_status (status),
  INDEX idx_runtime_sovereignty_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 314_create_cluster_continuity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_cluster_continuity (
  id               CHAR(26)     NOT NULL,
  cluster_id       VARCHAR(128) NOT NULL,
  cluster_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  cluster_data     JSON         NULL,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cluster_continuity_id (cluster_id),
  INDEX idx_cluster_continuity_status (status),
  INDEX idx_cluster_continuity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 315_create_autonomous_finalization.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_autonomous_finalization (
  id                  CHAR(26)     NOT NULL,
  finalization_id     CHAR(26)     NOT NULL,
  finalization_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  finalization_nonce  VARCHAR(128) NOT NULL,
  finalization_data   JSON         NULL,
  finalized_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_autonomous_finalization_id (finalization_id),
  UNIQUE KEY uq_autonomous_finalization_nonce (finalization_nonce, owner_server_id),
  INDEX idx_autonomous_finalization_status (status),
  INDEX idx_autonomous_finalization_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 316_create_runtime_succession.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_succession (
  id                CHAR(26)     NOT NULL,
  succession_id     CHAR(26)     NOT NULL,
  succession_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  target_server_id  VARCHAR(128) NULL,
  succession_nonce  VARCHAR(128) NOT NULL,
  succession_data   JSON         NULL,
  transferred_at    DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_succession_id (succession_id),
  UNIQUE KEY uq_runtime_succession_nonce (succession_nonce, owner_server_id),
  INDEX idx_runtime_succession_status (status),
  INDEX idx_runtime_succession_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 317_create_sovereignty_coordination.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_sovereignty_coordination (
  id                CHAR(26)     NOT NULL,
  coordination_id   VARCHAR(128) NOT NULL,
  coordination_type VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id   VARCHAR(128) NOT NULL,
  coordination_data JSON         NULL,
  synced_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sovereignty_coordination_id (coordination_id),
  INDEX idx_sovereignty_coordination_status (status),
  INDEX idx_sovereignty_coordination_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 318_create_sovereignty_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_sovereignty_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  sovereignty_id   VARCHAR(128) NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_sovereignty_audit_event (event_type),
  INDEX idx_sovereignty_audit_sovereignty (sovereignty_id),
  INDEX idx_sovereignty_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 319_create_core_finalization.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_core_finalization (
  id                  CHAR(26)     NOT NULL,
  finalization_id     CHAR(26)     NOT NULL,
  finalization_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  finalization_nonce  VARCHAR(128) NOT NULL,
  finalization_data   JSON         NULL,
  completed_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_core_finalization_id (finalization_id),
  UNIQUE KEY uq_core_finalization_nonce (finalization_nonce, owner_server_id),
  INDEX idx_core_finalization_status (status),
  INDEX idx_core_finalization_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 320_create_runtime_completion.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_completion (
  id               CHAR(26)     NOT NULL,
  completion_id    CHAR(26)     NOT NULL,
  completion_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  completion_nonce VARCHAR(128) NOT NULL,
  completion_data  JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_completion_id (completion_id),
  UNIQUE KEY uq_runtime_completion_nonce (completion_nonce, owner_server_id),
  INDEX idx_runtime_completion_status (status),
  INDEX idx_runtime_completion_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 321_create_production_seals.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_production_seals (
  id               CHAR(26)     NOT NULL,
  seal_id          CHAR(26)     NOT NULL,
  seal_type        VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'applied',
  owner_server_id  VARCHAR(128) NOT NULL,
  resource_id      VARCHAR(128) NOT NULL,
  seal_nonce       VARCHAR(128) NOT NULL,
  seal_data        JSON         NULL,
  locked_at        DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_seals_id (seal_id),
  UNIQUE KEY uq_production_seals_nonce (seal_nonce, owner_server_id),
  INDEX idx_production_seals_status (status),
  INDEX idx_production_seals_owner (owner_server_id),
  INDEX idx_production_seals_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 322_create_finalization_coordination.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_finalization_coordination (
  id                CHAR(26)     NOT NULL,
  coordination_id   VARCHAR(128) NOT NULL,
  coordination_type VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id   VARCHAR(128) NOT NULL,
  coordination_data JSON         NULL,
  synced_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_finalization_coordination_id (coordination_id),
  INDEX idx_finalization_coordination_status (status),
  INDEX idx_finalization_coordination_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 323_create_deterministic_sealing.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_deterministic_sealing (
  id              CHAR(26)     NOT NULL,
  sealing_id      CHAR(26)     NOT NULL,
  sealing_type    VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  sealing_nonce   VARCHAR(128) NOT NULL,
  sealing_data    JSON         NULL,
  sealed_at       DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_deterministic_sealing_id (sealing_id),
  UNIQUE KEY uq_deterministic_sealing_nonce (sealing_nonce, owner_server_id),
  INDEX idx_deterministic_sealing_status (status),
  INDEX idx_deterministic_sealing_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 324_create_core_finalization_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_core_finalization_audit (
  id               CHAR(26)     NOT NULL,
  event_type       VARCHAR(128) NOT NULL,
  finalization_id  VARCHAR(128) NULL,
  owner_server_id  VARCHAR(128) NULL,
  audit_data       JSON         NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_core_finalization_audit_event (event_type),
  INDEX idx_core_finalization_audit_fin (finalization_id),
  INDEX idx_core_finalization_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 325_create_runtime_gateway.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_gateway (
  id              CHAR(26)     NOT NULL,
  gateway_id      CHAR(26)     NOT NULL,
  gateway_type    VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  gateway_nonce   VARCHAR(128) NOT NULL,
  gateway_data    JSON         NULL,
  activated_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_gateway_id (gateway_id),
  UNIQUE KEY uq_runtime_gateway_nonce (gateway_nonce, owner_server_id),
  INDEX idx_runtime_gateway_status (status),
  INDEX idx_runtime_gateway_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 326_create_access_mesh.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_access_mesh (
  id              CHAR(26)     NOT NULL,
  mesh_id         VARCHAR(128) NOT NULL,
  mesh_type       VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  mesh_data       JSON         NULL,
  synced_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_access_mesh_id (mesh_id),
  INDEX idx_access_mesh_status (status),
  INDEX idx_access_mesh_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 327_create_gateway_routing.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_gateway_routing (
  id              CHAR(26)     NOT NULL,
  routing_id      VARCHAR(128) NOT NULL,
  routing_type    VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  routing_data    JSON         NULL,
  synced_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gateway_routing_id (routing_id),
  INDEX idx_gateway_routing_status (status),
  INDEX idx_gateway_routing_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 328_create_runtime_exposure.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_exposure (
  id              CHAR(26)     NOT NULL,
  exposure_id     CHAR(26)     NOT NULL,
  exposure_type   VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  exposure_nonce  VARCHAR(128) NOT NULL,
  exposure_data   JSON         NULL,
  exposed_at      DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_exposure_id (exposure_id),
  UNIQUE KEY uq_runtime_exposure_nonce (exposure_nonce, owner_server_id),
  INDEX idx_runtime_exposure_status (status),
  INDEX idx_runtime_exposure_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 329_create_surface_protection.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_surface_protection (
  id               CHAR(26)     NOT NULL,
  protection_id    CHAR(26)     NOT NULL,
  protection_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  protection_nonce VARCHAR(128) NOT NULL,
  protection_data  JSON         NULL,
  activated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_surface_protection_id (protection_id),
  UNIQUE KEY uq_surface_protection_nonce (protection_nonce, owner_server_id),
  INDEX idx_surface_protection_status (status),
  INDEX idx_surface_protection_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 330_create_gateway_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_gateway_audit (
  id              CHAR(26)     NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  resource_id     VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_gateway_audit_event (event_type),
  INDEX idx_gateway_audit_resource (resource_id),
  INDEX idx_gateway_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 331_create_runtime_hardening.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_hardening (
  id               CHAR(26)     NOT NULL,
  hardening_id     CHAR(26)     NOT NULL,
  hardening_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  hardening_nonce  VARCHAR(128) NOT NULL,
  hardening_data   JSON         NULL,
  hardened_at      DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_hardening_id (hardening_id),
  UNIQUE KEY uq_runtime_hardening_nonce (hardening_nonce, owner_server_id),
  INDEX idx_runtime_hardening_status (status),
  INDEX idx_runtime_hardening_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 332_create_immutable_security.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_immutable_security (
  id              CHAR(26)     NOT NULL,
  security_id     CHAR(26)     NOT NULL,
  security_type   VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  security_nonce  VARCHAR(128) NOT NULL,
  security_data   JSON         NULL,
  enforced_at     DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_immutable_security_id (security_id),
  UNIQUE KEY uq_immutable_security_nonce (security_nonce, owner_server_id),
  INDEX idx_immutable_security_status (status),
  INDEX idx_immutable_security_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 333_create_security_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_security_validation (
  id                CHAR(26)     NOT NULL,
  validation_id     CHAR(26)     NOT NULL,
  validation_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  validation_nonce  VARCHAR(128) NOT NULL,
  validation_data   JSON         NULL,
  validated_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_security_validation_id (validation_id),
  UNIQUE KEY uq_security_validation_nonce (validation_nonce, owner_server_id),
  INDEX idx_security_validation_status (status),
  INDEX idx_security_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 334_create_runtime_seal_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_seal_validation (
  id                    CHAR(26)     NOT NULL,
  seal_validation_id    CHAR(26)     NOT NULL,
  seal_type             VARCHAR(32)  NOT NULL,
  status                VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id       VARCHAR(128) NOT NULL,
  seal_validation_nonce VARCHAR(128) NOT NULL,
  resource_id           VARCHAR(128) NOT NULL,
  seal_data             JSON         NULL,
  verified_at           DATETIME(3)  NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_seal_validation_id (seal_validation_id),
  UNIQUE KEY uq_seal_validation_nonce (seal_validation_nonce, owner_server_id),
  INDEX idx_seal_validation_status (status),
  INDEX idx_seal_validation_owner (owner_server_id),
  INDEX idx_seal_validation_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 335_create_threat_mitigation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_threat_mitigation (
  id               CHAR(26)     NOT NULL,
  mitigation_id    CHAR(26)     NOT NULL,
  mitigation_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  mitigation_nonce VARCHAR(128) NOT NULL,
  mitigation_data  JSON         NULL,
  mitigated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_threat_mitigation_id (mitigation_id),
  UNIQUE KEY uq_threat_mitigation_nonce (mitigation_nonce, owner_server_id),
  INDEX idx_threat_mitigation_status (status),
  INDEX idx_threat_mitigation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 336_create_hardening_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_hardening_audit (
  id              CHAR(26)     NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  hardening_id    VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_hardening_audit_event (event_type),
  INDEX idx_hardening_audit_hardening (hardening_id),
  INDEX idx_hardening_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 337_create_runtime_sustainment.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_sustainment (
  id                CHAR(26)     NOT NULL,
  sustainment_id    CHAR(26)     NOT NULL,
  sustainment_type  VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  sustainment_nonce VARCHAR(128) NOT NULL,
  sustainment_data  JSON         NULL,
  started_at        DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_sustainment_id (sustainment_id),
  UNIQUE KEY uq_runtime_sustainment_nonce (sustainment_nonce, owner_server_id),
  INDEX idx_runtime_sustainment_status (status),
  INDEX idx_runtime_sustainment_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 338_create_infinite_recovery.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_infinite_recovery (
  id              CHAR(26)     NOT NULL,
  recovery_id     VARCHAR(128) NOT NULL,
  recovery_type   VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  recovery_data   JSON         NULL,
  synced_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  completed_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infinite_recovery_id (recovery_id),
  INDEX idx_infinite_recovery_status (status),
  INDEX idx_infinite_recovery_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 339_create_autonomous_maintenance.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_autonomous_maintenance (
  id                CHAR(26)     NOT NULL,
  maintenance_id    CHAR(26)     NOT NULL,
  maintenance_type  VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  maintenance_nonce VARCHAR(128) NOT NULL,
  maintenance_data  JSON         NULL,
  completed_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_autonomous_maintenance_id (maintenance_id),
  UNIQUE KEY uq_autonomous_maintenance_nonce (maintenance_nonce, owner_server_id),
  INDEX idx_autonomous_maintenance_status (status),
  INDEX idx_autonomous_maintenance_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 340_create_distributed_sustainment.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_distributed_sustainment (
  id                   CHAR(26)     NOT NULL,
  sustainment_node_id  VARCHAR(128) NOT NULL,
  node_type            VARCHAR(32)  NOT NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id      VARCHAR(128) NOT NULL,
  node_data            JSON         NULL,
  synced_at            DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_distributed_sustainment_node (sustainment_node_id),
  INDEX idx_distributed_sustainment_status (status),
  INDEX idx_distributed_sustainment_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 341_create_runtime_longevity.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_longevity (
  id              CHAR(26)     NOT NULL,
  longevity_id    CHAR(26)     NOT NULL,
  longevity_type  VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  longevity_nonce VARCHAR(128) NOT NULL,
  longevity_data  JSON         NULL,
  archived_at     DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_longevity_id (longevity_id),
  UNIQUE KEY uq_runtime_longevity_nonce (longevity_nonce, owner_server_id),
  INDEX idx_runtime_longevity_status (status),
  INDEX idx_runtime_longevity_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 342_create_sustainment_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_sustainment_audit (
  id              CHAR(26)     NOT NULL,
  event_type      VARCHAR(128) NOT NULL,
  sustainment_id  VARCHAR(128) NULL,
  owner_server_id VARCHAR(128) NULL,
  audit_data      JSON         NOT NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_sustainment_audit_event (event_type),
  INDEX idx_sustainment_audit_sustainment (sustainment_id),
  INDEX idx_sustainment_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 343_create_developer_platform.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_developer_platform (
  id               CHAR(26)     NOT NULL,
  platform_id      CHAR(26)     NOT NULL,
  platform_type    VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  platform_nonce   VARCHAR(128) NOT NULL,
  platform_data    JSON         NULL,
  activated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_developer_platform_id (platform_id),
  UNIQUE KEY uq_developer_platform_nonce (platform_nonce, owner_server_id),
  INDEX idx_developer_platform_status (status),
  INDEX idx_developer_platform_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 344_create_sdk_registry.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_sdk_registry (
  id               CHAR(26)     NOT NULL,
  sdk_id           VARCHAR(128) NOT NULL,
  sdk_type         VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  sdk_data         JSON         NULL,
  registered_at    DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sdk_registry_id (sdk_id),
  INDEX idx_sdk_registry_status (status),
  INDEX idx_sdk_registry_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 345_create_plugin_compatibility.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_plugin_compatibility (
  id                   CHAR(26)     NOT NULL,
  compatibility_id     CHAR(26)     NOT NULL,
  compatibility_type   VARCHAR(32)  NOT NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id      VARCHAR(128) NOT NULL,
  compatibility_nonce  VARCHAR(128) NOT NULL,
  compatibility_data   JSON         NULL,
  validated_at         DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_plugin_compatibility_id (compatibility_id),
  UNIQUE KEY uq_plugin_compatibility_nonce (compatibility_nonce, owner_server_id),
  INDEX idx_plugin_compatibility_status (status),
  INDEX idx_plugin_compatibility_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 346_create_extension_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_extension_runtime (
  id               CHAR(26)     NOT NULL,
  extension_id     CHAR(26)     NOT NULL,
  extension_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  extension_nonce  VARCHAR(128) NOT NULL,
  extension_data   JSON         NULL,
  activated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_extension_runtime_id (extension_id),
  UNIQUE KEY uq_extension_runtime_nonce (extension_nonce, owner_server_id),
  INDEX idx_extension_runtime_status (status),
  INDEX idx_extension_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 347_create_contract_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_contract_validation (
  id               CHAR(26)     NOT NULL,
  contract_id      CHAR(26)     NOT NULL,
  contract_type    VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  contract_nonce   VARCHAR(128) NOT NULL,
  contract_data    JSON         NULL,
  validated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_contract_validation_id (contract_id),
  UNIQUE KEY uq_contract_validation_nonce (contract_nonce, owner_server_id),
  INDEX idx_contract_validation_status (status),
  INDEX idx_contract_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 348_create_developer_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_developer_audit (
  id               CHAR(26)     NOT NULL,
  entity_id        VARCHAR(128) NULL,
  event_type       VARCHAR(128) NOT NULL,
  event_data       JSON         NULL,
  occurred_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_developer_audit_event (event_type),
  INDEX idx_developer_audit_entity (entity_id),
  INDEX idx_developer_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 349_create_release_governance.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_release_governance (
  id               CHAR(26)     NOT NULL,
  governance_id    CHAR(26)     NOT NULL,
  governance_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  governance_nonce VARCHAR(128) NOT NULL,
  governance_data  JSON         NULL,
  started_at       DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_release_governance_id (governance_id),
  UNIQUE KEY uq_release_governance_nonce (governance_nonce, owner_server_id),
  INDEX idx_release_governance_status (status),
  INDEX idx_release_governance_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 350_create_production_deployments.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_production_deployments (
  id               CHAR(26)     NOT NULL,
  deployment_id    VARCHAR(128) NOT NULL,
  deployment_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  deployment_data  JSON         NULL,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_deployment_id (deployment_id),
  INDEX idx_production_deployment_status (status),
  INDEX idx_production_deployment_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 351_create_release_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_release_validation (
  id                CHAR(26)     NOT NULL,
  validation_id     CHAR(26)     NOT NULL,
  validation_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  validation_nonce  VARCHAR(128) NOT NULL,
  validation_data   JSON         NULL,
  validated_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_release_validation_id (validation_id),
  UNIQUE KEY uq_release_validation_nonce (validation_nonce, owner_server_id),
  INDEX idx_release_validation_status (status),
  INDEX idx_release_validation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 352_create_release_orchestration.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_release_orchestration (
  id                  CHAR(26)     NOT NULL,
  orchestration_id    VARCHAR(128) NOT NULL,
  orchestration_type  VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id     VARCHAR(128) NOT NULL,
  orchestration_data  JSON         NULL,
  synced_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_release_orchestration_id (orchestration_id),
  INDEX idx_release_orchestration_status (status),
  INDEX idx_release_orchestration_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 353_create_global_release_runtime.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_global_release_runtime (
  id               CHAR(26)     NOT NULL,
  release_id       CHAR(26)     NOT NULL,
  release_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  release_nonce    VARCHAR(128) NOT NULL,
  release_data     JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_release_id (release_id),
  UNIQUE KEY uq_global_release_nonce (release_nonce, owner_server_id),
  INDEX idx_global_release_status (status),
  INDEX idx_global_release_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 354_create_release_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_release_audit (
  id               CHAR(26)     NOT NULL,
  entity_id        VARCHAR(128) NULL,
  event_type       VARCHAR(128) NOT NULL,
  event_data       JSON         NULL,
  occurred_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_release_audit_event (event_type),
  INDEX idx_release_audit_entity (entity_id),
  INDEX idx_release_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 355_create_enterprise_readiness.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_enterprise_readiness (
  id               CHAR(26)     NOT NULL,
  readiness_id     CHAR(26)     NOT NULL,
  readiness_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  readiness_nonce  VARCHAR(128) NOT NULL,
  readiness_data   JSON         NULL,
  confirmed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_readiness_id (readiness_id),
  UNIQUE KEY uq_enterprise_readiness_nonce (readiness_nonce, owner_server_id),
  INDEX idx_enterprise_readiness_status (status),
  INDEX idx_enterprise_readiness_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 356_create_deterministic_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_deterministic_audit (
  id               CHAR(26)     NOT NULL,
  audit_id         CHAR(26)     NOT NULL,
  audit_type       VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  audit_nonce      VARCHAR(128) NOT NULL,
  audit_data       JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_deterministic_audit_id (audit_id),
  UNIQUE KEY uq_deterministic_audit_nonce (audit_nonce, owner_server_id),
  INDEX idx_deterministic_audit_status (status),
  INDEX idx_deterministic_audit_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 357_create_integrity_verification.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_integrity_verification (
  id                  CHAR(26)     NOT NULL,
  verification_id     CHAR(26)     NOT NULL,
  verification_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  verification_nonce  VARCHAR(128) NOT NULL,
  verification_data   JSON         NULL,
  verified_at         DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_integrity_verification_id (verification_id),
  UNIQUE KEY uq_integrity_verification_nonce (verification_nonce, owner_server_id),
  INDEX idx_integrity_verification_status (status),
  INDEX idx_integrity_verification_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 358_create_production_readiness.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_production_readiness (
  id                       CHAR(26)     NOT NULL,
  readiness_checkpoint_id  VARCHAR(128) NOT NULL,
  checkpoint_type          VARCHAR(32)  NOT NULL,
  status                   VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id          VARCHAR(128) NOT NULL,
  checkpoint_data          JSON         NULL,
  synced_at                DATETIME(3)  NOT NULL DEFAULT NOW(3),
  confirmed_at             DATETIME(3)  NULL,
  created_at               DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at               DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_readiness_id (readiness_checkpoint_id),
  INDEX idx_production_readiness_status (status),
  INDEX idx_production_readiness_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 359_create_distributed_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_distributed_audit (
  id               CHAR(26)     NOT NULL,
  audit_node_id    VARCHAR(128) NOT NULL,
  node_type        VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  node_data        JSON         NULL,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_distributed_audit_node_id (audit_node_id),
  INDEX idx_distributed_audit_status (status),
  INDEX idx_distributed_audit_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 360_create_enterprise_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_enterprise_audit (
  id               CHAR(26)     NOT NULL,
  entity_id        VARCHAR(128) NULL,
  event_type       VARCHAR(128) NOT NULL,
  event_data       JSON         NULL,
  occurred_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  INDEX idx_enterprise_audit_event (event_type),
  INDEX idx_enterprise_audit_entity (entity_id),
  INDEX idx_enterprise_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 0361_core_closure.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_core_closure (
  id               CHAR(26)     NOT NULL,
  closure_id       CHAR(26)     NOT NULL,
  closure_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  closure_nonce    VARCHAR(128) NOT NULL,
  closure_data     JSON,
  sealed_at        DATETIME(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_core_closure_nonce (closure_nonce, owner_server_id),
  KEY idx_core_closure_status (status),
  KEY idx_core_closure_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 0362_runtime_immutability.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_runtime_immutability (
  id                  CHAR(26)     NOT NULL,
  immutability_id     CHAR(26)     NOT NULL,
  immutability_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  immutability_nonce  VARCHAR(128) NOT NULL,
  immutability_data   JSON,
  frozen_at           DATETIME(3),
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_immutability_nonce (immutability_nonce, owner_server_id),
  KEY idx_runtime_immutability_status (status),
  KEY idx_runtime_immutability_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 0363_production_freeze.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_production_freeze (
  id               CHAR(26)     NOT NULL,
  freeze_id        VARCHAR(128) NOT NULL,
  freeze_type      VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id  VARCHAR(128) NOT NULL,
  freeze_data      JSON,
  synced_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_production_freeze_id (freeze_id),
  KEY idx_production_freeze_status (status),
  KEY idx_production_freeze_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 0364_distributed_closure.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_distributed_closure (
  id                 CHAR(26)     NOT NULL,
  closure_node_id    VARCHAR(128) NOT NULL,
  node_type          VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id    VARCHAR(128) NOT NULL,
  closure_node_data  JSON,
  synced_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_distributed_closure_node_id (closure_node_id),
  KEY idx_distributed_closure_status (status),
  KEY idx_distributed_closure_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 0365_final_validation.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_final_validation (
  id                CHAR(26)     NOT NULL,
  validation_id     CHAR(26)     NOT NULL,
  validation_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  validation_nonce  VARCHAR(128) NOT NULL,
  validation_data   JSON,
  validated_at      DATETIME(3),
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_final_validation_nonce (validation_nonce, owner_server_id),
  KEY idx_final_validation_status (status),
  KEY idx_final_validation_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 0366_core_closure_audit.sql
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_core_closure_audit (
  id          CHAR(26)     NOT NULL,
  entity_id   VARCHAR(128) NOT NULL,
  event_type  VARCHAR(128) NOT NULL,
  event_data  JSON,
  occurred_at DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  KEY idx_core_closure_audit_entity (entity_id),
  KEY idx_core_closure_audit_occurred (occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
-- End of Atlantic Core schema.
