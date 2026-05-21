CREATE TABLE IF NOT EXISTS atc_infinite_recovery (
  id              CHAR(26)     NOT NULL,
  recovery_id     VARCHAR(128) NOT NULL,
  recovery_type   VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'active',
  owner_server_id VARCHAR(128) NOT NULL,
  recovery_data   JSON         NULL,
  synced_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  completed_at    DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infinite_recovery_id (recovery_id),
  INDEX idx_infinite_recovery_status (status),
  INDEX idx_infinite_recovery_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
