-- Migration 016 — Item Runtime Fields
-- Phase 8: Usable Item Runtime
-- Adds runtime slot fields (durability, equipped, last_used_at) to character inventory
-- and action config storage to item definitions.
-- All statements use IF NOT EXISTS guards for safe re-run idempotency.

-- ── atc_character_inventory: runtime slot fields ──────────────────────────────

ALTER TABLE atc_character_inventory
  ADD COLUMN IF NOT EXISTS durability   INT UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS equipped     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP NULL DEFAULT NULL;

-- Durability check constraint (separate statement for safety across MariaDB versions)
ALTER TABLE atc_character_inventory
  ADD CONSTRAINT IF NOT EXISTS chk_inv_durability CHECK (durability >= 0);

CREATE INDEX IF NOT EXISTS idx_inv_equipped ON atc_character_inventory (character_id, equipped);

-- ── atc_item_definitions: action config ──────────────────────────────────────
-- Stores the runtime action config (type, cooldownMs, consumeQuantity, etc.)
-- NULL = item is not usable via the runtime.

ALTER TABLE atc_item_definitions
  ADD COLUMN IF NOT EXISTS action_config_json JSON NULL DEFAULT NULL;
