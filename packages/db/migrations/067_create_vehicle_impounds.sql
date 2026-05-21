CREATE TABLE IF NOT EXISTS atc_vehicle_impounds (
  id                           CHAR(26)     NOT NULL,
  vehicle_id                   CHAR(26)     NOT NULL,
  reason                       ENUM('traffic_stop','abandoned','evidence',
                                    'unpaid_fees','emergency_tow','other')
                                            NOT NULL,
  impounded_by_principal_id    VARCHAR(128) NOT NULL,
  agency_id                    CHAR(26)     NULL,
  location_id                  VARCHAR(64)  NULL,
  evidence_hold                TINYINT(1)   NOT NULL DEFAULT 0,
  fee                          INT UNSIGNED NOT NULL DEFAULT 0,
  notes                        TEXT         NULL,
  impounded_at                 DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  released_at                  DATETIME(3)  NULL,
  released_by_principal_id     VARCHAR(128) NULL,
  release_notes                TEXT         NULL,
  PRIMARY KEY (id),
  INDEX idx_vi_vehicle (vehicle_id),
  INDEX idx_vi_active  (vehicle_id, released_at),
  CONSTRAINT fk_vi_vehicle FOREIGN KEY (vehicle_id)
    REFERENCES atc_vehicles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
