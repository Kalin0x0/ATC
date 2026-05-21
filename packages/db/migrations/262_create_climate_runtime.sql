CREATE TABLE IF NOT EXISTS atc_climate_runtime (
  id               VARCHAR(26)   NOT NULL,
  region_id        VARCHAR(128)  NOT NULL,
  climate_type     ENUM('tropical','temperate','arctic','arid','continental','custom') NOT NULL,
  status           ENUM('stable','changing','extreme','recovering') NOT NULL DEFAULT 'stable',
  owner_server_id  VARCHAR(128)  NOT NULL,
  temperature      DECIMAL(8,4)  NOT NULL DEFAULT 0.0000,
  humidity         DECIMAL(8,4)  NOT NULL DEFAULT 0.0000,
  climate_data     JSON          NOT NULL,
  measured_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_climate_region (region_id),
  KEY idx_climate_status (status),
  KEY idx_climate_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
