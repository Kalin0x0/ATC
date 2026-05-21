CREATE TABLE IF NOT EXISTS atc_survival_runtime (
  id              VARCHAR(26)   NOT NULL,
  player_id       VARCHAR(128)  NOT NULL,
  body_temp       DECIMAL(5,2)  NOT NULL DEFAULT 37.00,
  hydration_level DECIMAL(5,2)  NOT NULL DEFAULT 100.00,
  fatigue_level   DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  survival_status VARCHAR(32)   NOT NULL DEFAULT 'normal',
  penalty_flags   TEXT          NOT NULL DEFAULT '[]',
  owner_server_id VARCHAR(128)  NULL,
  last_tick_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_survival_player (player_id),
  INDEX idx_survival_status (survival_status),
  INDEX idx_survival_tick (last_tick_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
