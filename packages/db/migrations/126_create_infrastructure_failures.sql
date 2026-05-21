CREATE TABLE IF NOT EXISTS atc_infrastructure_failures (
  id                VARCHAR(26)    NOT NULL,
  infrastructure_id VARCHAR(26)    NOT NULL,
  failure_nonce     VARCHAR(128)   NOT NULL,
  failure_type      VARCHAR(64)    NOT NULL DEFAULT 'degraded',
  severity          VARCHAR(32)    NOT NULL DEFAULT 'minor',
  description       TEXT           NULL,
  detected_at       DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at       DATETIME(3)    NULL,
  resolved_by       VARCHAR(128)   NULL,
  created_at        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_infra_failure_nonce (failure_nonce),
  INDEX idx_infra_failure_infra (infrastructure_id),
  INDEX idx_infra_failure_severity (severity),
  INDEX idx_infra_failure_resolved (resolved_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
