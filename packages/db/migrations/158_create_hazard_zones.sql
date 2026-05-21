CREATE TABLE IF NOT EXISTS atc_hazard_zones (
  id                  VARCHAR(26)    NOT NULL,
  zone_id             VARCHAR(128)   NOT NULL,
  disaster_id         VARCHAR(128)   NULL,
  hazard_type         VARCHAR(64)    NOT NULL,
  severity            DECIMAL(5,2)   NOT NULL DEFAULT 50.00,
  status              VARCHAR(32)    NOT NULL DEFAULT 'active',
  propagation_radius  DECIMAL(10,2)  NULL,
  created_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_hazard_zone_id (zone_id),
  INDEX idx_hazard_disaster (disaster_id),
  INDEX idx_hazard_type (hazard_type),
  INDEX idx_hazard_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
