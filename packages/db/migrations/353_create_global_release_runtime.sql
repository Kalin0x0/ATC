CREATE TABLE IF NOT EXISTS atc_global_release_runtime (
  id               CHAR(26)     NOT NULL,
  release_id       CHAR(26)     NOT NULL,
  release_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  release_nonce    VARCHAR(128) NOT NULL,
  release_data     JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_global_release_id (release_id),
  UNIQUE KEY uq_global_release_nonce (release_nonce, owner_server_id),
  INDEX idx_global_release_status (status),
  INDEX idx_global_release_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
