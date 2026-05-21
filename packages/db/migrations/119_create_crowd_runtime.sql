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
