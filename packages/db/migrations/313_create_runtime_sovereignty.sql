CREATE TABLE IF NOT EXISTS atc_runtime_sovereignty (
  id                 CHAR(26)     NOT NULL,
  sovereignty_id     CHAR(26)     NOT NULL,
  sovereignty_type   VARCHAR(32)  NOT NULL,
  status             VARCHAR(32)  NOT NULL DEFAULT 'establishing',
  owner_server_id    VARCHAR(128) NOT NULL,
  sovereignty_nonce  VARCHAR(128) NOT NULL,
  sovereignty_data   JSON         NULL,
  established_at     DATETIME(3)  NULL,
  created_at         DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at         DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_sovereignty_id (sovereignty_id),
  UNIQUE KEY uq_runtime_sovereignty_nonce (sovereignty_nonce, owner_server_id),
  INDEX idx_runtime_sovereignty_status (status),
  INDEX idx_runtime_sovereignty_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
