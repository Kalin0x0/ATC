CREATE TABLE IF NOT EXISTS atc_runtime_sustainment (
  id                CHAR(26)     NOT NULL,
  sustainment_id    CHAR(26)     NOT NULL,
  sustainment_type  VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  sustainment_nonce VARCHAR(128) NOT NULL,
  sustainment_data  JSON         NULL,
  started_at        DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_sustainment_id (sustainment_id),
  UNIQUE KEY uq_runtime_sustainment_nonce (sustainment_nonce, owner_server_id),
  INDEX idx_runtime_sustainment_status (status),
  INDEX idx_runtime_sustainment_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
