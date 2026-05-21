CREATE TABLE IF NOT EXISTS atc_runtime_exposure (
  id              CHAR(26)     NOT NULL,
  exposure_id     CHAR(26)     NOT NULL,
  exposure_type   VARCHAR(32)  NOT NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128) NOT NULL,
  exposure_nonce  VARCHAR(128) NOT NULL,
  exposure_data   JSON         NULL,
  exposed_at      DATETIME(3)  NULL,
  created_at      DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at      DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_exposure_id (exposure_id),
  UNIQUE KEY uq_runtime_exposure_nonce (exposure_nonce, owner_server_id),
  INDEX idx_runtime_exposure_status (status),
  INDEX idx_runtime_exposure_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
