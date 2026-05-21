CREATE TABLE IF NOT EXISTS atc_resource_consumption (
  id               VARCHAR(26)    NOT NULL,
  consumer_id      VARCHAR(128)   NOT NULL,
  consumer_type    VARCHAR(64)    NOT NULL DEFAULT 'building',
  grid_id          VARCHAR(128)   NOT NULL,
  resource_type    VARCHAR(64)    NOT NULL DEFAULT 'power',
  amount           FLOAT          NOT NULL DEFAULT 0.0,
  recorded_at      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_resource_consumer (consumer_id),
  INDEX idx_resource_grid (grid_id),
  INDEX idx_resource_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
