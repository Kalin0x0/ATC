CREATE TABLE IF NOT EXISTS atc_runtime_certification (
  id                   CHAR(26)     NOT NULL,
  certification_id     CHAR(26)     NOT NULL,
  certification_type   VARCHAR(32)  NOT NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id      VARCHAR(128) NOT NULL,
  certification_nonce  VARCHAR(128) NOT NULL,
  certification_data   JSON         NULL,
  certified_at         DATETIME(3)  NULL,
  created_at           DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at           DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_certification_id (certification_id),
  UNIQUE KEY uq_runtime_certification_nonce (certification_nonce, owner_server_id),
  INDEX idx_runtime_certification_status (status),
  INDEX idx_runtime_certification_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
