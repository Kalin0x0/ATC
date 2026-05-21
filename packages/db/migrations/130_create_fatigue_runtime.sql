CREATE TABLE IF NOT EXISTS atc_fatigue_runtime (
  id           VARCHAR(26)   NOT NULL,
  player_id    VARCHAR(128)  NOT NULL,
  fatigue_level DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  rest_debt    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  last_rest_at DATETIME(3)   NULL,
  last_tick_at DATETIME(3)   NULL,
  created_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fatigue_player (player_id),
  INDEX idx_fatigue_level (fatigue_level),
  INDEX idx_fatigue_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
