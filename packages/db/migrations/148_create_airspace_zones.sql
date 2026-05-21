CREATE TABLE IF NOT EXISTS atc_airspace_zones (
  id               VARCHAR(26)    NOT NULL,
  zone_id          VARCHAR(128)   NOT NULL,
  zone_name        VARCHAR(255)   NOT NULL,
  zone_type        VARCHAR(64)    NOT NULL,
  min_altitude_m   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  max_altitude_m   DECIMAL(10,2)  NOT NULL DEFAULT 10000.00,
  status           VARCHAR(32)    NOT NULL DEFAULT 'open',
  owner_server_id  VARCHAR(128)   NULL,
  created_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_zone_id (zone_id),
  INDEX idx_airspace_status (status),
  INDEX idx_airspace_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
