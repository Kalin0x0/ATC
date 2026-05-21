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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
