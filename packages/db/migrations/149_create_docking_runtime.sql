CREATE TABLE IF NOT EXISTS atc_docking_runtime (
  id             VARCHAR(26)    NOT NULL,
  docking_id     VARCHAR(128)   NOT NULL,
  docking_nonce  VARCHAR(128)   NOT NULL,
  vessel_id      VARCHAR(128)   NOT NULL,
  dock_zone_id   VARCHAR(128)   NOT NULL,
  slot_id        VARCHAR(128)   NULL,
  status         VARCHAR(32)    NOT NULL DEFAULT 'occupied',
  docked_at      DATETIME(3)    NULL,
  undocked_at    DATETIME(3)    NULL,
  created_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_docking_id (docking_id),
  UNIQUE KEY uq_docking_nonce (docking_nonce),
  INDEX idx_docking_vessel (vessel_id),
  INDEX idx_docking_zone (dock_zone_id),
  INDEX idx_docking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
