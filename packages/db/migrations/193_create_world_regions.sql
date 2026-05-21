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
