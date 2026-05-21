CREATE TABLE IF NOT EXISTS atc_environmental_exposure (
  id            VARCHAR(26)   NOT NULL,
  player_id     VARCHAR(128)  NOT NULL,
  hazard_id     VARCHAR(128)  NOT NULL,
  exposure_type VARCHAR(64)   NOT NULL,
  severity      DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  exposed_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ended_at      DATETIME(3)   NULL,
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_exposure_player (player_id),
  INDEX idx_exposure_hazard (hazard_id),
  INDEX idx_exposure_active (ended_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
