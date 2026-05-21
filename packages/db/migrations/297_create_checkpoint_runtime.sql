CREATE TABLE IF NOT EXISTS atc_checkpoint_runtime (
  id                CHAR(26)     NOT NULL,
  checkpoint_id     CHAR(26)     NOT NULL,
  checkpoint_type   VARCHAR(32)  NOT NULL,
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id   VARCHAR(128) NOT NULL,
  checkpoint_nonce  VARCHAR(128) NOT NULL,
  checkpoint_data   JSON         NULL,
  committed_at      DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkpoint_runtime_id (checkpoint_id),
  UNIQUE KEY uq_checkpoint_runtime_nonce (checkpoint_nonce, owner_server_id),
  INDEX idx_checkpoint_runtime_status (status),
  INDEX idx_checkpoint_runtime_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
