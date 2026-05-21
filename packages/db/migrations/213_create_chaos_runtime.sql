CREATE TABLE IF NOT EXISTS atc_chaos_runtime (
  id               VARCHAR(26)   NOT NULL,
  test_id          VARCHAR(128)  NOT NULL,
  test_type        VARCHAR(64)   NOT NULL,
  status           VARCHAR(32)   NOT NULL DEFAULT 'pending',
  target_server_id VARCHAR(128)  NULL,
  chaos_data       TEXT          NOT NULL DEFAULT '{}',
  started_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_chaos_test_id (test_id),
  KEY idx_chaos_status (status),
  KEY idx_chaos_target (target_server_id),
  KEY idx_chaos_type (test_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
