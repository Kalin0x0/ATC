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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
