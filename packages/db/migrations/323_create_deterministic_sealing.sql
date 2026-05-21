CREATE TABLE IF NOT EXISTS atc_deterministic_sealing (
  id              CHAR(26)     NOT NULL,
  sealing_id      CHAR(26)     NOT NULL,
  sealing_type    VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  sealing_nonce   VARCHAR(128) NOT NULL,
  sealing_data    JSON         NULL,
  sealed_at       DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_deterministic_sealing_id (sealing_id),
  UNIQUE KEY uq_deterministic_sealing_nonce (sealing_nonce, owner_server_id),
  INDEX idx_deterministic_sealing_status (status),
  INDEX idx_deterministic_sealing_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
