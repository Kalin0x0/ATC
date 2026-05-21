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
