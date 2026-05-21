CREATE TABLE IF NOT EXISTS atc_vehicle_fleet_assignments (
  id                           CHAR(26)     NOT NULL,
  vehicle_id                   CHAR(26)     NOT NULL,
  organization_id              CHAR(26)     NULL,
  principal_id                 VARCHAR(128) NULL,
  assigned_by_principal_id     VARCHAR(128) NOT NULL,
  role                         VARCHAR(64)  NOT NULL DEFAULT 'general',
  expires_at                   DATETIME(3)  NULL,
  unassigned_at                DATETIME(3)  NULL,
  unassigned_by_principal_id   VARCHAR(128) NULL,
  assigned_at                  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_vfa_vehicle      (vehicle_id),
  INDEX idx_vfa_organization (organization_id),
  INDEX idx_vfa_principal    (principal_id),
  INDEX idx_vfa_active       (vehicle_id, unassigned_at),
  CONSTRAINT fk_vfa_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
