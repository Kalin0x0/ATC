CREATE TABLE IF NOT EXISTS atc_runtime_diagnostics (
  id              VARCHAR(26)   NOT NULL,
  diagnostic_id   VARCHAR(128)  NOT NULL,
  diagnostic_type VARCHAR(64)   NOT NULL,
  entity_id       VARCHAR(128)  NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  owner_server_id VARCHAR(128)  NOT NULL,
  diagnostic_data TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_diagnostic_entity (entity_id),
  KEY idx_diagnostic_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
