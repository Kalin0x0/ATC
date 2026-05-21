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
