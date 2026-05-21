CREATE TABLE IF NOT EXISTS atc_verification_runtime (
  id                  CHAR(26)     NOT NULL,
  verification_id     CHAR(26)     NOT NULL,
  verification_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  verification_nonce  VARCHAR(128) NOT NULL,
  verification_data   JSON         NULL,
  verified_at         DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_verification_runtime_id (verification_id),
  UNIQUE KEY uq_verification_runtime_nonce (verification_nonce, owner_server_id),
  INDEX idx_verification_runtime_status (status),
  INDEX idx_verification_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
