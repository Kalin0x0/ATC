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
