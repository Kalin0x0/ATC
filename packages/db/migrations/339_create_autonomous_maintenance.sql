CREATE TABLE IF NOT EXISTS atc_autonomous_maintenance (
  id                CHAR(26)     NOT NULL,
  maintenance_id    CHAR(26)     NOT NULL,
  maintenance_type  VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  maintenance_nonce VARCHAR(128) NOT NULL,
  maintenance_data  JSON         NULL,
  completed_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_autonomous_maintenance_id (maintenance_id),
  UNIQUE KEY uq_autonomous_maintenance_nonce (maintenance_nonce, owner_server_id),
  INDEX idx_autonomous_maintenance_status (status),
  INDEX idx_autonomous_maintenance_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
