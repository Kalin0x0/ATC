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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
