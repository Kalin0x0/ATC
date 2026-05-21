CREATE TABLE IF NOT EXISTS atc_extension_runtime (
  id               CHAR(26)     NOT NULL,
  extension_id     CHAR(26)     NOT NULL,
  extension_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  extension_nonce  VARCHAR(128) NOT NULL,
  extension_data   JSON         NULL,
  activated_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_extension_runtime_id (extension_id),
  UNIQUE KEY uq_extension_runtime_nonce (extension_nonce, owner_server_id),
  INDEX idx_extension_runtime_status (status),
  INDEX idx_extension_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
