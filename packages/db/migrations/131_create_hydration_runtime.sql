CREATE TABLE IF NOT EXISTS atc_hydration_runtime (
  id              VARCHAR(26)   NOT NULL,
  player_id       VARCHAR(128)  NOT NULL,
  hydration_level DECIMAL(5,2)  NOT NULL DEFAULT 100.00,
  depletion_rate  DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  last_drink_at   DATETIME(3)   NULL,
  last_tick_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hydration_player (player_id),
  INDEX idx_hydration_level (hydration_level),
  INDEX idx_hydration_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
