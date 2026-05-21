CREATE TABLE IF NOT EXISTS atc_recovery_operations (
  id              VARCHAR(26)   NOT NULL,
  operation_id    VARCHAR(128)  NOT NULL,
  operation_type  VARCHAR(64)   NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'pending',
  entity_id       VARCHAR(128)  NULL,
  owner_server_id VARCHAR(128)  NOT NULL,
  recovery_data   TEXT          NOT NULL DEFAULT '{}',
  started_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at    DATETIME(3)   NULL,
  created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_recovery_operation_id (operation_id),
  KEY idx_recovery_op_status (status),
  KEY idx_recovery_op_entity (entity_id),
  KEY idx_recovery_op_server (owner_server_id),
  KEY idx_recovery_op_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
