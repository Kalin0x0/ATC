CREATE TABLE IF NOT EXISTS atc_runtime_lockdown (
  id               CHAR(26)     NOT NULL,
  lockdown_id      CHAR(26)     NOT NULL,
  lockdown_type    VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'initiated',
  owner_server_id  VARCHAR(128) NOT NULL,
  lockdown_nonce   VARCHAR(128) NOT NULL,
  lockdown_data    JSON         NULL,
  lifted_at        DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_lockdown_id (lockdown_id),
  UNIQUE KEY uq_runtime_lockdown_nonce (lockdown_nonce, owner_server_id),
  INDEX idx_runtime_lockdown_status (status),
  INDEX idx_runtime_lockdown_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
