CREATE TABLE IF NOT EXISTS atc_deterministic_audit (
  id               CHAR(26)     NOT NULL,
  audit_id         CHAR(26)     NOT NULL,
  audit_type       VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  audit_nonce      VARCHAR(128) NOT NULL,
  audit_data       JSON         NULL,
  completed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_deterministic_audit_id (audit_id),
  UNIQUE KEY uq_deterministic_audit_nonce (audit_nonce, owner_server_id),
  INDEX idx_deterministic_audit_status (status),
  INDEX idx_deterministic_audit_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
