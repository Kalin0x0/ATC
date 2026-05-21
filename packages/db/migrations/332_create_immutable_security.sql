CREATE TABLE IF NOT EXISTS atc_immutable_security (
  id              CHAR(26)     NOT NULL,
  security_id     CHAR(26)     NOT NULL,
  security_type   VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  security_nonce  VARCHAR(128) NOT NULL,
  security_data   JSON         NULL,
  enforced_at     DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_immutable_security_id (security_id),
  UNIQUE KEY uq_immutable_security_nonce (security_nonce, owner_server_id),
  INDEX idx_immutable_security_status (status),
  INDEX idx_immutable_security_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
