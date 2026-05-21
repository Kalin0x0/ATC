CREATE TABLE IF NOT EXISTS atc_failure_correlation (
  id               VARCHAR(26)   NOT NULL,
  correlation_id   VARCHAR(128)  NOT NULL,
  failure_type     VARCHAR(64)   NOT NULL,
  source_node      VARCHAR(128)  NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'open',
  owner_server_id  VARCHAR(128)  NOT NULL,
  correlation_data TEXT          NOT NULL DEFAULT '{}',
  correlated_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at      DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_correlation_id (correlation_id),
  KEY idx_correlation_status (status),
  KEY idx_correlation_owner (owner_server_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
