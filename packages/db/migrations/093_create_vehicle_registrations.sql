CREATE TABLE IF NOT EXISTS atc_vehicle_registrations (
  id                     VARCHAR(26)  NOT NULL,
  vehicle_id             VARCHAR(26)  NOT NULL,
  owner_principal_id     VARCHAR(26)  NOT NULL,
  plate                  VARCHAR(16)  NOT NULL,
  status                 ENUM('active','expired','suspended','revoked') NOT NULL DEFAULT 'active',
  registered_at          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at             DATETIME(3)  NOT NULL,
  renewed_at             DATETIME(3)  NULL,
  suspended_at           DATETIME(3)  NULL,
  revoked_at             DATETIME(3)  NULL,
  revoked_by_principal_id VARCHAR(26) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicle_registrations_plate (plate),
  INDEX idx_vehicle_reg_vehicle_id (vehicle_id),
  INDEX idx_vehicle_reg_owner (owner_principal_id),
  INDEX idx_vehicle_reg_status_expires (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
