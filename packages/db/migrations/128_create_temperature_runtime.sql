CREATE TABLE IF NOT EXISTS atc_temperature_runtime (
  id            VARCHAR(26)   NOT NULL,
  player_id     VARCHAR(128)  NOT NULL,
  current_temp  DECIMAL(5,2)  NOT NULL DEFAULT 37.00,
  temp_trend    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  exposure_zone VARCHAR(128)  NULL,
  last_tick_at  DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_temp_player (player_id),
  INDEX idx_temp_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
