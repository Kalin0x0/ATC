CREATE TABLE IF NOT EXISTS atc_lockdown_recovery (
  id               CHAR(26)     NOT NULL,
  closure_id       CHAR(26)     NOT NULL,
  closure_type     VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  closure_nonce    VARCHAR(128) NOT NULL,
  closure_data     JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_lockdown_recovery_closure_id (closure_id),
  UNIQUE KEY uq_lockdown_recovery_nonce (closure_nonce, owner_server_id),
  INDEX idx_lockdown_recovery_status (status),
  INDEX idx_lockdown_recovery_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
