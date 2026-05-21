CREATE TABLE IF NOT EXISTS atc_autonomous_finalization (
  id                  CHAR(26)     NOT NULL,
  finalization_id     CHAR(26)     NOT NULL,
  finalization_type   VARCHAR(32)  NOT NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'pending',
  owner_server_id     VARCHAR(128) NOT NULL,
  finalization_nonce  VARCHAR(128) NOT NULL,
  finalization_data   JSON         NULL,
  finalized_at        DATETIME(3)  NULL,
  created_at          DATETIME(3)  NOT NULL DEFAULT NOW(3),
  updated_at          DATETIME(3)  NOT NULL DEFAULT NOW(3) ON UPDATE NOW(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_autonomous_finalization_id (finalization_id),
  UNIQUE KEY uq_autonomous_finalization_nonce (finalization_nonce, owner_server_id),
  INDEX idx_autonomous_finalization_status (status),
  INDEX idx_autonomous_finalization_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
