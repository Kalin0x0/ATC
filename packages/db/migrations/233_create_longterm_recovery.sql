CREATE TABLE IF NOT EXISTS atc_longterm_recovery (
  id              VARCHAR(26)   NOT NULL,
  recovery_id     VARCHAR(128)  NOT NULL,
  recovery_type   VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  recovery_nonce  VARCHAR(128)  NOT NULL,
  recovery_data   TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_recovery_nonce (recovery_nonce),
  KEY idx_recovery_status (status),
  KEY idx_recovery_entity (entity_id),
  KEY idx_recovery_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
