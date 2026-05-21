CREATE TABLE IF NOT EXISTS atc_crosssystem_arbitration (
  id                 CHAR(26)     NOT NULL,
  arbitration_id     CHAR(26)     NOT NULL,
  arbitration_type   VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id    VARCHAR(128) NOT NULL,
  arbitration_nonce  VARCHAR(128) NOT NULL,
  arbitration_data   JSON         NULL,
  resolved_at        DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_crosssystem_arbitration_id (arbitration_id),
  UNIQUE KEY uq_crosssystem_arbitration_nonce (arbitration_nonce, owner_server_id),
  INDEX idx_crosssystem_arbitration_status (status),
  INDEX idx_crosssystem_arbitration_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
