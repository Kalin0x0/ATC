CREATE TABLE IF NOT EXISTS atc_runtime_resilience (
  id              VARCHAR(26)   NOT NULL,
  record_id       VARCHAR(128)  NOT NULL,
  resilience_type VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'healthy',
  owner_server_id VARCHAR(128)  NOT NULL,
  health_score    INT           NOT NULL DEFAULT 100,
  resilience_data TEXT          NOT NULL DEFAULT '{}',
  last_check_at   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_resilience_record_id (record_id),
  KEY idx_resilience_status (status),
  KEY idx_resilience_server (owner_server_id),
  KEY idx_resilience_health (health_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
