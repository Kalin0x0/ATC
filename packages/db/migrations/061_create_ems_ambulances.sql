CREATE TABLE atc_ems_ambulances (
  id               CHAR(26)     NOT NULL,
  unit_id          VARCHAR(128) NOT NULL,
  status           ENUM('available','dispatched','en_route','transporting','hospital') NOT NULL DEFAULT 'available',
  emergency_id     CHAR(26)     NULL,
  facility_id      VARCHAR(128) NULL,
  last_updated_by  VARCHAR(128) NOT NULL,
  created_at       DATETIME(3)  NOT NULL,
  updated_at       DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ambulance_unit  (unit_id),
  INDEX idx_ambulance_status    (status),
  INDEX idx_ambulance_emergency (emergency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
