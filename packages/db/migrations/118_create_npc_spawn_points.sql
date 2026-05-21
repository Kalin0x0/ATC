CREATE TABLE IF NOT EXISTS atc_npc_spawn_points (
  id            VARCHAR(26)    NOT NULL,
  zone_id       VARCHAR(128)   NOT NULL,
  position_x    FLOAT          NOT NULL DEFAULT 0,
  position_y    FLOAT          NOT NULL DEFAULT 0,
  position_z    FLOAT          NOT NULL DEFAULT 0,
  heading       FLOAT          NOT NULL DEFAULT 0,
  spawn_type    VARCHAR(64)    NOT NULL DEFAULT 'ambient',
  is_enabled    TINYINT(1)     NOT NULL DEFAULT 1,
  last_used_at  DATETIME(3)    NULL,
  created_at    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_spawn_point_zone (zone_id),
  INDEX idx_spawn_point_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
