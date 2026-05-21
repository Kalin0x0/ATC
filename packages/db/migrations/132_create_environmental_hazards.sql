CREATE TABLE IF NOT EXISTS atc_environmental_hazards (
  id              VARCHAR(26)   NOT NULL,
  hazard_id       VARCHAR(128)  NOT NULL,
  hazard_type     VARCHAR(64)   NOT NULL,
  zone_id         VARCHAR(128)  NOT NULL,
  severity        DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  owner_server_id VARCHAR(128)  NULL,
  started_at      DATETIME(3)   NULL,
  ended_at        DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hazard_id (hazard_id),
  INDEX idx_hazard_zone (zone_id),
  INDEX idx_hazard_active (is_active),
  INDEX idx_hazard_type (hazard_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
