CREATE TABLE IF NOT EXISTS atc_enterprise_readiness (
  id               CHAR(26)     NOT NULL,
  readiness_id     CHAR(26)     NOT NULL,
  readiness_type   VARCHAR(32)  NOT NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id  VARCHAR(128) NOT NULL,
  readiness_nonce  VARCHAR(128) NOT NULL,
  readiness_data   JSON         NULL,
  confirmed_at     DATETIME(3)  NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_enterprise_readiness_id (readiness_id),
  UNIQUE KEY uq_enterprise_readiness_nonce (readiness_nonce, owner_server_id),
  INDEX idx_enterprise_readiness_status (status),
  INDEX idx_enterprise_readiness_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
