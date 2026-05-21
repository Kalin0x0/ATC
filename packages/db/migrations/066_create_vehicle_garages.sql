CREATE TABLE IF NOT EXISTS atc_vehicle_garages (
  id                           CHAR(26)     NOT NULL,
  vehicle_id                   CHAR(26)     NOT NULL,
  garage_id                    VARCHAR(64)  NOT NULL,
  stored_by_principal_id       VARCHAR(128) NOT NULL,
  stored_at                    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  retrieved_at                 DATETIME(3)  NULL,
  retrieved_by_principal_id    VARCHAR(128) NULL,
  PRIMARY KEY (id),
  INDEX idx_vg_vehicle      (vehicle_id),
  INDEX idx_vg_garage       (garage_id),
  INDEX idx_vg_active       (vehicle_id, retrieved_at),
  CONSTRAINT fk_vg_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
