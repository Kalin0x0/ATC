-- ---------------------------------------------------------------------------
-- 363_create_ground_loot.sql
-- ---------------------------------------------------------------------------
-- Phase 98 — Ground loot piles.
--
-- Piles used to exist only in each client's memory: game/atc-core/client/
-- ground_loot.lua drew a bag and the server kept no record of it, so a pickup
-- could not be granted — the item list would have had to come from the client,
-- and nothing but the client knew when a pile had already been taken.
--
-- With the contents here, the server decides what a pile holds and who gets it,
-- and a pile survives a restart instead of vanishing with the clients that drew it.

CREATE TABLE IF NOT EXISTS atc_ground_loot (
  id                        CHAR(26)     NOT NULL,
  -- World position. DOUBLE rather than DECIMAL: these are game coordinates,
  -- compared by distance and never summed, so binary floats are exactly right.
  world_x                   DOUBLE       NOT NULL,
  world_y                   DOUBLE       NOT NULL,
  world_z                   DOUBLE       NOT NULL,
  -- Who dropped it, when that is known. NULL for piles the world produced —
  -- a raid reward, a wreck, an admin spawn.
  dropped_by_character_id   CHAR(26)     NULL,
  -- Free-text origin, mirrored into the inventory transaction on pickup so the
  -- item history says where a thing came from.
  reason                    VARCHAR(64)  NULL,
  status                    ENUM('active','picked_up','expired') NOT NULL DEFAULT 'active',
  picked_up_by_character_id CHAR(26)     NULL,
  picked_up_at              DATETIME(3)  NULL,
  -- NULL never expires. Sweeping expired piles is a separate concern; the
  -- column is what makes it possible.
  expires_at                DATETIME(3)  NULL,
  created_at                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                         ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  -- Resync on boot reads active piles and nothing else.
  INDEX idx_ground_loot_status (status, expires_at),
  INDEX idx_ground_loot_dropped_by (dropped_by_character_id)
  -- No foreign key on the character columns: a pile outlives the character who
  -- dropped it, and deleting a character must not delete loot other players can
  -- already see on the ground.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS atc_ground_loot_items (
  id         CHAR(26)     NOT NULL,
  loot_id    CHAR(26)     NOT NULL,
  -- References atc_item_definitions.id. Not a foreign key for the same reason
  -- as the recipe ingredients: an unknown item fails the pickup, not the write.
  item_id    VARCHAR(128) NOT NULL,
  quantity   INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  -- One row per item in a pile; two of a thing is a quantity, not two rows.
  UNIQUE KEY uq_ground_loot_item (loot_id, item_id),
  INDEX idx_ground_loot_item_loot (loot_id),
  CONSTRAINT fk_ground_loot_item_loot FOREIGN KEY (loot_id)
    REFERENCES atc_ground_loot (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
