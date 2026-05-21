CREATE TABLE IF NOT EXISTS atc_utility_grids (
  id               VARCHAR(26)    NOT NULL,
  grid_id          VARCHAR(128)   NOT NULL,
  grid_type        VARCHAR(64)    NOT NULL DEFAULT 'power',
  status           VARCHAR(32)    NOT NULL DEFAULT 'online',
  capacity         FLOAT          NOT NULL DEFAULT 100.0,
  current_load     FLOAT          NOT NULL DEFAULT 0.0,
  owner_server_id  VARCHAR(128)   NULL,
  last_tick_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_utility_grid_id (grid_id),
  INDEX idx_utility_grid_type (grid_type),
  INDEX idx_utility_grid_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
