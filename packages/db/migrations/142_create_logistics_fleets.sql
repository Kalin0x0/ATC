CREATE TABLE IF NOT EXISTS atc_logistics_fleets (
  id                 VARCHAR(26)   NOT NULL,
  fleet_id           VARCHAR(128)  NOT NULL,
  fleet_name         VARCHAR(256)  NOT NULL,
  owner_principal_id VARCHAR(128)  NOT NULL,
  vehicle_ids        TEXT          NOT NULL DEFAULT '[]',
  status             VARCHAR(32)   NOT NULL DEFAULT 'available',
  assigned_route_id  VARCHAR(128)  NULL,
  created_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fleet_id (fleet_id),
  INDEX idx_fleet_owner (owner_principal_id),
  INDEX idx_fleet_status (status),
  INDEX idx_fleet_route (assigned_route_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
