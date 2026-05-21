CREATE TABLE IF NOT EXISTS atc_runtime_completion (
  id               CHAR(26)     NOT NULL,
  completion_id    CHAR(26)     NOT NULL,
  completion_type  VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  completion_nonce VARCHAR(128) NOT NULL,
  completion_data  JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_completion_id (completion_id),
  UNIQUE KEY uq_runtime_completion_nonce (completion_nonce, owner_server_id),
  INDEX idx_runtime_completion_status (status),
  INDEX idx_runtime_completion_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
