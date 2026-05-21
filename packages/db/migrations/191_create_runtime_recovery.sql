CREATE TABLE IF NOT EXISTS atc_runtime_recovery (
  id               VARCHAR(26)   NOT NULL,
  recovery_id      VARCHAR(26)   NOT NULL,
  entity_id        VARCHAR(128)  NOT NULL,
  recovery_type    VARCHAR(32)   NOT NULL,
  target_server_id VARCHAR(128)  NULL,
  recovery_status  VARCHAR(32)   NOT NULL DEFAULT 'pending',
  completed_at     DATETIME(3)   NULL,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_recovery_id (recovery_id),
  KEY idx_runtime_recovery_entity (entity_id),
  KEY idx_runtime_recovery_status (recovery_status),
  KEY idx_runtime_recovery_type (recovery_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
