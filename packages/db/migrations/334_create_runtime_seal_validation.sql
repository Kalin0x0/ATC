CREATE TABLE IF NOT EXISTS atc_runtime_seal_validation (
  id                    CHAR(26)     NOT NULL,
  seal_validation_id    CHAR(26)     NOT NULL,
  seal_type             VARCHAR(32)  NOT NULL,
  status                VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id       VARCHAR(128) NOT NULL,
  seal_validation_nonce VARCHAR(128) NOT NULL,
  resource_id           VARCHAR(128) NOT NULL,
  seal_data             JSON         NULL,
  verified_at           DATETIME(3)  NULL,
  created_at            DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at            DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_seal_validation_id (seal_validation_id),
  UNIQUE KEY uq_seal_validation_nonce (seal_validation_nonce, owner_server_id),
  INDEX idx_seal_validation_status (status),
  INDEX idx_seal_validation_owner (owner_server_id),
  INDEX idx_seal_validation_resource (resource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
