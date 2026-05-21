CREATE TABLE IF NOT EXISTS atc_runtime_immutability (
  id                  CHAR(26)     NOT NULL,
  immutability_id     CHAR(26)     NOT NULL,
  immutability_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  immutability_nonce  VARCHAR(128) NOT NULL,
  immutability_data   JSON,
  frozen_at           DATETIME(3),
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_runtime_immutability_nonce (immutability_nonce, owner_server_id),
  KEY idx_runtime_immutability_status (status),
  KEY idx_runtime_immutability_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
