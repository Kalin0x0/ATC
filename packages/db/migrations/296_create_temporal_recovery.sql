CREATE TABLE IF NOT EXISTS atc_temporal_recovery (
  id                 CHAR(26)     NOT NULL,
  recovery_id        CHAR(26)     NOT NULL,
  recovery_type      VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id    VARCHAR(128) NOT NULL,
  recovery_nonce     VARCHAR(128) NOT NULL,
  target_timestamp   DATETIME(3)  NULL,
  recovery_data      JSON         NULL,
  completed_at       DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_temporal_recovery_id (recovery_id),
  UNIQUE KEY uq_temporal_recovery_nonce (recovery_nonce, owner_server_id),
  INDEX idx_temporal_recovery_status (status),
  INDEX idx_temporal_recovery_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
